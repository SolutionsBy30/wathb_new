import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from './accounts.service';
import { GoalSetupDto } from './dto/people.dto';
import { ReportsService } from '../reports/reports.service';
import { MagicLinkService } from '../auth/magic-link.service';
import { AuditLogService } from '../admin-ops/audit-log.service';

export type AdminStudentSort = 'name' | 'subscriptionEnd' | 'performance' | 'createdAt';

@Injectable()
export class StudentsService {
  constructor(
    private prisma: PrismaService,
    private accounts: AccountsService,
    private reports: ReportsService,
    private magicLinks: MagicLinkService,
    private config: ConfigService,
    private auditLog: AuditLogService,
  ) {}

  /**
   * Admin support tool: mint a login link for a student who can't receive
   * OTP (broken WhatsApp, changed device, walk-in support case). Purpose
   * 'renewal' lands them on Home with a normal scoped session — of the
   * existing MagicLinkPurpose values it's the only one that isn't tied to a
   * specific wathb/report target. Every mint is audit-logged with the
   * acting admin, since this is effectively "log in as any student".
   */
  async mintLoginLink(studentId: string, adminUserId: string) {
    const student = await this.prisma.student.findUnique({ where: { userId: studentId }, include: { user: true } });
    if (!student) throw new NotFoundException('student not found');
    const link = await this.magicLinks.mint({ subjectId: studentId, subjectType: 'student', purpose: 'renewal' });
    const appUrl = this.config.get<string>('STUDENT_APP_URL', 'http://localhost:5173/wathb');
    const admin = await this.prisma.user.findUnique({ where: { id: adminUserId }, select: { name: true, email: true } });
    await this.auditLog.record({
      actorId: adminUserId,
      actorLabel: admin?.email ?? admin?.name ?? adminUserId,
      action: 'student.login_link_minted',
      entityType: 'Student',
      entityId: studentId,
      note: `admin-minted login link for ${student.user.name}`,
    });
    return { url: `${appUrl}/#magic=${link.token}`, expiresAt: link.expiresAt };
  }

  createStudent(mobile: string, name: string) {
    return this.accounts.createStudent(mobile, name);
  }

  /**
   * ADM-050 — admin students list. Filterable by school/city, sortable by
   * name/subscription end date/performance (composite index). Composite
   * index and subscription end date aren't stored columns, so a sort by
   * either fetches the full filtered set and sorts/paginates in memory
   * rather than pushing the sort into Prisma — a documented, pragmatic
   * limit fine at today's data volumes (same trade-off as the cohort
   * report's live-computed aggregation).
   */
  async adminList(search?: string, offset = 0, limit = 50, sortBy: AdminStudentSort = 'createdAt', sortDir: 'asc' | 'desc' = 'desc', schoolId?: string, cityId?: string) {
    const where = {
      ...(search ? { user: { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { mobileE164: { contains: search } }] } } : {}),
      ...(schoolId ? { schoolId } : {}),
      ...(cityId ? { school: { cityId } } : {}),
    };

    if (sortBy === 'createdAt') {
      const [total, items] = await this.prisma.$transaction([
        this.prisma.student.count({ where }),
        this.prisma.student.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { user: { createdAt: sortDir } },
          include: {
            user: true,
            targetTest: true,
            school: { include: { city: true } },
            subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
            _count: { select: { answers: true } },
          },
        }),
      ]);
      const ids = items.map((s) => s.userId);
      const compositeIndexById = await this.reports.getCompositeIndexBulk(ids);
      return {
        total,
        items: items.map((s) => ({ ...s, compositeIndex: compositeIndexById.get(s.userId) ?? null, subscriptionEnd: s.subscriptions[0]?.endsAt ?? null })),
      };
    }

    const all = await this.prisma.student.findMany({
      where,
      include: {
        user: true,
        targetTest: true,
        school: { include: { city: true } },
        subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { answers: true } },
      },
    });
    const compositeIndexById = await this.reports.getCompositeIndexBulk(all.map((s) => s.userId));
    const withComposite = all.map((s) => ({ ...s, compositeIndex: compositeIndexById.get(s.userId) ?? null, subscriptionEnd: s.subscriptions[0]?.endsAt ?? null }));

    const dir = sortDir === 'asc' ? 1 : -1;
    withComposite.sort((a, b) => {
      if (sortBy === 'name') return dir * a.user.name.localeCompare(b.user.name, 'ar');
      if (sortBy === 'subscriptionEnd') {
        if (!a.subscriptionEnd && !b.subscriptionEnd) return 0;
        if (!a.subscriptionEnd) return 1; // nulls last regardless of direction
        if (!b.subscriptionEnd) return -1;
        return dir * (a.subscriptionEnd.getTime() - b.subscriptionEnd.getTime());
      }
      // performance (composite index)
      if (a.compositeIndex === null && b.compositeIndex === null) return 0;
      if (a.compositeIndex === null) return 1;
      if (b.compositeIndex === null) return -1;
      return dir * (a.compositeIndex - b.compositeIndex);
    });

    return { total: withComposite.length, items: withComposite.slice(offset, offset + limit) };
  }

  setSchool(studentId: string, schoolId: string | null) {
    return this.prisma.student.update({ where: { userId: studentId }, data: { schoolId } });
  }

  /**
   * ADM-052 — everything the student list's report link-out doesn't show:
   * subscription/payment history, the notification-delivery log, raw
   * session-by-session answers, and a device/link access log — for support
   * and abuse investigation. Each list is capped rather than paginated;
   * that's enough for a single student's history at today's data volumes
   * and keeps this one call instead of four separate paginated endpoints.
   */
  async adminDetail(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentId },
      include: { user: true, targetTest: true, school: { include: { city: true } } },
    });
    if (!student) throw new NotFoundException('student not found');

    const [subscriptions, notifications, sessions, magicLinks, supervisors] = await Promise.all([
      this.prisma.subscription.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' }, include: { package: true } }),
      this.prisma.notification.findMany({ where: { userId: studentId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.wathb.findMany({
        where: { studentId },
        orderBy: { scheduledFor: 'desc' },
        take: 30,
        include: { answers: { select: { isCorrect: true, timeTakenMs: true, timedOut: true, isReview: true, answeredAt: true, labelId: true } } },
      }),
      this.prisma.magicLink.findMany({
        where: { subjectId: studentId, subjectType: 'student' },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { accessLog: { orderBy: { accessedAt: 'desc' } } },
      }),
      // ADM-087 — needed so the detail screen can send this student's weekly
      // report to a specific supervisor. Only accepted, unrevoked links: an
      // invite nobody answered has no one to send to.
      this.prisma.studentSupervisor.findMany({
        where: { studentId, acceptedAt: { not: null }, revokedAt: null },
        include: { supervisor: { include: { user: { select: { name: true, mobileE164: true } } } } },
      }),
    ]);

    return { student, subscriptions, notifications, sessions, magicLinks, supervisors };
  }

  /** Admin lookup for manual actions (e.g. wire-transfer activation) — exact mobile match. */
  async searchByMobile(mobile: string) {
    const user = await this.prisma.user.findUnique({
      where: { mobileE164: mobile },
      include: {
        student: {
          include: {
            targetTest: true,
            subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, include: { package: true } },
          },
        },
      },
    });
    if (!user || !user.student) return null;
    return {
      studentId: user.id,
      name: user.name,
      mobile: user.mobileE164,
      targetTest: user.student.targetTest?.nameAr ?? null,
      latestSubscription: user.student.subscriptions[0] ?? null,
    };
  }

  async me(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentId },
      include: { user: true, targetTest: true },
    });
    if (!student) throw new NotFoundException('student not found');
    return student;
  }

  async listSupervisors(studentId: string) {
    return this.prisma.studentSupervisor.findMany({
      where: { studentId, revokedAt: null },
      include: { supervisor: { include: { user: true } } },
    });
  }

  /**
   * STU-002/STU-024 — the tests the student's package covers, each with its
   * own enable flag and goal. Rows are materialised lazily from the active
   * package's testIds so a package upgrade immediately exposes its extra
   * tests without a migration or a background job.
   */
  async myTests(studentId: string) {
    const student = await this.prisma.student.findUniqueOrThrow({ where: { userId: studentId } });
    const activeSub = await this.prisma.subscription.findFirst({
      where: { studentId, status: 'active' },
      include: { package: true },
      orderBy: { createdAt: 'desc' },
    });
    // STU-031 — the whole live catalogue is listed, not just the package's
    // tests. Scoping the list to covered tests meant a student without a
    // subscription saw exactly one row and had nothing to switch on, so
    // "activate several tests" was impossible to express in the UI. Coverage
    // is reported per row as `isCovered` and still decides what a leap may be
    // taken against (WathbService.today) — enabling is a preparation choice,
    // paying is what unlocks it.
    const catalogue = await this.prisma.test.findMany({ where: { isActive: true }, orderBy: { nameAr: 'asc' } });
    const coveredIds = new Set(activeSub?.package.testIds ?? []);
    const existing = await this.prisma.studentTest.findMany({ where: { studentId } });
    const known = new Set(existing.map((e) => e.testId));
    const missing = catalogue.filter((t) => !known.has(t.id));
    if (missing.length > 0) {
      await this.prisma.studentTest.createMany({
        // Newly-exposed tests start disabled — an upgrade shouldn't silently
        // change what the student is preparing for; they opt in.
        data: missing.map((t) => ({ studentId, testId: t.id, isActive: t.id === student.targetTestId })),
        skipDuplicates: true,
      });
    }
    const rows = await this.prisma.studentTest.findMany({
      where: { studentId, testId: { in: catalogue.map((t) => t.id) } },
      include: { test: true },
    });
    const order = new Map(catalogue.map((t, i) => [t.id, i]));
    return {
      focusedTestId: student.targetTestId,
      tests: rows
        .sort((a, b) => (order.get(a.testId) ?? 0) - (order.get(b.testId) ?? 0))
        .map((r) => ({
          testId: r.testId,
          nameAr: r.test.nameAr,
          nameEn: r.test.nameEn,
          isActive: r.isActive,
          isCovered: coveredIds.has(r.testId),
          targetScore: r.targetScore,
          testDate: r.testDate,
          isFocused: r.testId === student.targetTestId,
        })),
    };
  }

  /**
   * Enable/disable a covered test or update its goal. Disabling the focused
   * test moves focus to another enabled one rather than leaving the student
   * with a focus they've switched off (which would break today()).
   */
  async updateMyTest(studentId: string, testId: string, dto: { isActive?: boolean; targetScore?: number | null; testDate?: string | null; focus?: boolean }) {
    // Switching off the last one would leave focus pointing at a disabled
    // test, which today() would still happily serve — a state the profile
    // screen can't represent. Refuse instead of producing the contradiction.
    if (dto.isActive === false) {
      const stillEnabled = await this.prisma.studentTest.count({
        where: { studentId, isActive: true, NOT: { testId } },
      });
      if (stillEnabled === 0) {
        throw new BadRequestException('at least one test must stay enabled');
      }
    }

    const row = await this.prisma.studentTest.upsert({
      where: { studentId_testId: { studentId, testId } },
      create: {
        studentId,
        testId,
        isActive: dto.isActive ?? true,
        targetScore: dto.targetScore ?? undefined,
        testDate: dto.testDate ? new Date(dto.testDate) : undefined,
      },
      update: {
        isActive: dto.isActive,
        targetScore: dto.targetScore === null ? null : dto.targetScore,
        testDate: dto.testDate === null ? null : dto.testDate ? new Date(dto.testDate) : undefined,
      },
    });

    const student = await this.prisma.student.findUniqueOrThrow({ where: { userId: studentId } });
    let nextFocus = student.targetTestId;
    if (dto.focus && row.isActive) nextFocus = testId;
    if (row.isActive === false && student.targetTestId === testId) {
      const fallback = await this.prisma.studentTest.findFirst({ where: { studentId, isActive: true, NOT: { testId } } });
      nextFocus = fallback?.testId ?? student.targetTestId;
    }
    if (nextFocus !== student.targetTestId) {
      await this.prisma.student.update({ where: { userId: studentId }, data: { targetTestId: nextFocus } });
    }
    return this.myTests(studentId);
  }

  /**
   * Leap history — every bundle the student has taken, newest first, with
   * its date, test, and score. Shared verbatim by the student's own screen,
   * the supervisor's student view, and the admin student detail so all three
   * report the same thing.
   */
  /**
   * ADM-097 — one leap, question by question: what was asked, what the
   * student picked, what was right.
   *
   * leapHistory gives a score and nothing else, so "why did this student get
   * 3/5" was unanswerable from the console — support and content review both
   * needed the actual answers, and reading them out of the database by hand
   * is not a workflow.
   *
   * studentId is part of the WHERE rather than checked afterwards: the route
   * takes both ids from the URL, and matching on the pair means a wathbId
   * belonging to someone else simply does not resolve.
   */
  async leapDetail(studentId: string, wathbId: string) {
    const wathb = await this.prisma.wathb.findFirst({
      where: { id: wathbId, studentId },
      include: {
        test: true,
        questions: {
          orderBy: { position: 'asc' },
          include: { questionVersion: true, question: { include: { label: true } } },
        },
      },
    });
    if (!wathb) throw new NotFoundException('leap not found for this student');

    const answers = await this.prisma.answer.findMany({ where: { wathbId } });
    const byQuestion = new Map(answers.map((a) => [a.questionId, a]));

    return {
      wathbId: wathb.id,
      scheduledFor: wathb.scheduledFor,
      sequence: wathb.sequence,
      status: wathb.status,
      completedAt: wathb.completedAt,
      testNameAr: wathb.test?.nameAr ?? null,
      // ADM-012 — the console renders stems in the test's own direction.
      contentLanguage: wathb.test?.language ?? 'ar',
      questions: wathb.questions.map((wq) => {
        const a = byQuestion.get(wq.questionId);
        const options = (wq.questionVersion.options as { key: string; text: string }[] | null) ?? [];
        const textFor = (key: string | null | undefined) =>
          key == null ? null : (options.find((o) => o.key === key)?.text ?? key);
        return {
          position: wq.position,
          questionId: wq.questionId,
          labelNameAr: wq.question.label?.nameAr ?? null,
          stem: wq.questionVersion.stem,
          stemImageUrl: wq.questionVersion.stemImageUrl,
          options,
          correctKey: wq.questionVersion.correctKey,
          correctText: textFor(wq.questionVersion.correctKey),
          explanation: wq.questionVersion.explanation,
          // null rather than false when unanswered: "not answered" and
          // "answered wrongly" are different facts and the screen shows them
          // differently.
          selectedKey: a?.selectedKey ?? null,
          selectedText: textFor(a?.selectedKey),
          isCorrect: a ? a.isCorrect : null,
          timedOut: a?.timedOut ?? false,
          timeTakenMs: a?.timeTakenMs ?? null,
          answeredAt: a?.answeredAt ?? null,
        };
      }),
    };
  }

  async leapHistory(studentId: string, limit = 100) {
    const wathbs = await this.prisma.wathb.findMany({
      where: { studentId },
      orderBy: [{ scheduledFor: 'desc' }, { sequence: 'desc' }],
      take: limit,
      include: { test: true, questions: { select: { questionId: true } } },
    });
    const ids = wathbs.map((w) => w.id);
    const answers = await this.prisma.answer.findMany({
      where: { wathbId: { in: ids } },
      select: { wathbId: true, isCorrect: true },
    });
    const byWathb = new Map<string, { total: number; correct: number }>();
    for (const a of answers) {
      const cur = byWathb.get(a.wathbId!) ?? { total: 0, correct: 0 };
      cur.total++;
      if (a.isCorrect) cur.correct++;
      byWathb.set(a.wathbId!, cur);
    }
    return wathbs.map((w) => {
      const tally = byWathb.get(w.id) ?? { total: 0, correct: 0 };
      return {
        wathbId: w.id,
        scheduledFor: w.scheduledFor,
        sequence: w.sequence,
        bundleType: w.bundleType,
        status: w.status,
        completedAt: w.completedAt,
        testNameAr: w.test?.nameAr ?? null,
        testNameEn: w.test?.nameEn ?? null,
        totalQuestions: w.questions.length,
        answered: tally.total,
        correct: tally.correct,
        accuracy: tally.total > 0 ? tally.correct / tally.total : null,
      };
    });
  }

  async setGoal(studentId: string, dto: GoalSetupDto) {
    // Keep the per-test goal table in step with onboarding's single-test
    // choice, so the profile screen has a row to show from day one.
    await this.prisma.studentTest.upsert({
      where: { studentId_testId: { studentId, testId: dto.targetTestId } },
      create: { studentId, testId: dto.targetTestId, isActive: true, targetScore: dto.targetScore, testDate: dto.testDate ? new Date(dto.testDate) : undefined },
      update: { isActive: true, targetScore: dto.targetScore, testDate: dto.testDate ? new Date(dto.testDate) : undefined },
    });
    return this.prisma.student.update({
      where: { userId: studentId },
      data: {
        targetTestId: dto.targetTestId,
        track: dto.track,
        targetScore: dto.targetScore,
        testDate: dto.testDate ? new Date(dto.testDate) : undefined,
      },
    });
  }

  setNotificationPrefs(studentId: string, dto: { notifSlotStartHour?: number; notifSlotEndHour?: number; skipDays?: number[] }) {
    return this.prisma.student.update({
      where: { userId: studentId },
      data: dto,
      select: { notifSlotStartHour: true, notifSlotEndHour: true, skipDays: true },
    });
  }
}
