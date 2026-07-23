import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MagicLinkService } from '../auth/magic-link.service';
import { MIN_SAMPLE_FOR_REPORTING, ReportsService } from '../reports/reports.service';
import { AccountsService } from './accounts.service';

@Injectable()
export class SupervisorsService {
  constructor(
    private prisma: PrismaService,
    private magicLinks: MagicLinkService,
    private accounts: AccountsService,
    private reports: ReportsService,
  ) {}

  createSupervisor(mobile: string, name: string, type: 'parent' | 'instructor') {
    return this.accounts.createSupervisor(mobile, name, type);
  }

  /** Admin "المشرفون" screen — every supervisor and how many students they're linked to. */
  async adminList() {
    const supervisors = await this.prisma.supervisor.findMany({
      include: {
        user: true,
        studentLinks: { where: { revokedAt: null }, include: { student: { include: { user: true } } } },
      },
      orderBy: { user: { createdAt: 'desc' } },
    });
    return supervisors.map((s) => ({
      supervisorId: s.userId,
      name: s.user.name,
      mobile: s.user.mobileE164,
      type: s.type,
      students: s.studentLinks.map((l) => ({
        studentId: l.studentId,
        name: l.student.user.name,
        accepted: !!l.acceptedAt,
      })),
    }));
  }

  /** Student invites a supervisor by mobile — spec §2: "linking is done by student invite." */
  async invite(studentId: string, mobile: string, name: string, type: 'parent' | 'instructor') {
    // FRE-006/FRE-007 — server-enforced, not just an omitted button: a
    // free-tier student cannot add a supervisor at all. The frontend still
    // renders the invite affordance in a locked state with an upgrade
    // prompt rather than hiding it, per spec.
    const activeSub = await this.prisma.subscription.findFirst({
      where: { studentId, status: 'active' },
      include: { package: true },
      orderBy: { createdAt: 'desc' },
    });
    if (activeSub && !activeSub.package.supervisorLinkingAllowed) {
      throw new ForbiddenException('supervisor linking is not available on the free package');
    }

    let supervisorUser = await this.prisma.user.findUnique({ where: { mobileE164: mobile } });
    if (!supervisorUser) {
      supervisorUser = await this.prisma.user.create({
        data: { mobileE164: mobile, name, role: 'supervisor', supervisor: { create: { type } } },
      });
    } else if (supervisorUser.role !== 'supervisor') {
      throw new BadRequestException('this mobile number belongs to a non-supervisor account');
    }

    const link = await this.prisma.studentSupervisor.upsert({
      where: { studentId_supervisorId: { studentId, supervisorId: supervisorUser.id } },
      create: { studentId, supervisorId: supervisorUser.id },
      update: { revokedAt: null },
    });

    const magicLink = await this.magicLinks.mint({
      subjectId: supervisorUser.id,
      subjectType: 'supervisor',
      purpose: 'link_invite',
      targetId: link.id,
    });

    return { studentSupervisorId: link.id, inviteToken: magicLink.token, expiresAt: magicLink.expiresAt };
  }

  async acceptInvite(supervisorId: string, studentSupervisorId: string) {
    const link = await this.prisma.studentSupervisor.findUnique({ where: { id: studentSupervisorId } });
    if (!link) throw new NotFoundException('invite not found');
    if (link.supervisorId !== supervisorId) throw new ForbiddenException();
    // A rejected invite is revoked without ever having been accepted — that
    // must stay a dead end, not something a later accept call can revive
    // into the contradictory "accepted and revoked" state.
    if (link.revokedAt) throw new BadRequestException('invite was rejected or revoked');
    return this.prisma.studentSupervisor.update({ where: { id: studentSupervisorId }, data: { acceptedAt: new Date() } });
  }

  // SUP-007 — reject reuses revokedAt (a link that's revoked without ever
  // having been accepted reads unambiguously as "rejected"), so no new
  // status column is needed alongside the existing accept/revoke pair.
  async rejectInvite(supervisorId: string, studentSupervisorId: string) {
    const link = await this.prisma.studentSupervisor.findUnique({ where: { id: studentSupervisorId } });
    if (!link) throw new NotFoundException('invite not found');
    if (link.supervisorId !== supervisorId) throw new ForbiddenException();
    if (link.acceptedAt) throw new BadRequestException('invite was already accepted — use revoke instead');
    if (link.revokedAt) throw new BadRequestException('invite was already rejected');
    return this.prisma.studentSupervisor.update({ where: { id: studentSupervisorId }, data: { revokedAt: new Date() } });
  }

  // SUP-007 — pending invites shall be browsable within a logged-in
  // session, not only reachable by tapping the original magic link.
  async listPendingInvites(supervisorId: string) {
    return this.prisma.studentSupervisor.findMany({
      where: { supervisorId, acceptedAt: null, revokedAt: null },
      include: { student: { include: { user: true } } },
      orderBy: { id: 'desc' },
    });
  }

  /** Consent is explicit and revocable by the student — spec §2. */
  async revoke(studentId: string, studentSupervisorId: string) {
    const link = await this.prisma.studentSupervisor.findUnique({ where: { id: studentSupervisorId } });
    if (!link || link.studentId !== studentId) throw new NotFoundException('link not found');
    return this.prisma.studentSupervisor.update({ where: { id: studentSupervisorId }, data: { revokedAt: new Date() } });
  }

  async dashboard(supervisorId: string) {
    const supervisor = await this.prisma.supervisor.findUnique({ where: { userId: supervisorId } });
    if (!supervisor) throw new NotFoundException('supervisor not found');

    const links = await this.prisma.studentSupervisor.findMany({
      where: { supervisorId, acceptedAt: { not: null }, revokedAt: null },
      include: { student: { include: { user: true } } },
    });

    const cards = await Promise.all(
      links.map(async (link) => {
        const stats = await this.prisma.studentLabelStat.findMany({
          where: { studentId: link.studentId },
          include: { label: true },
        });
        const reportable = stats.filter((s) => s.nAnswered >= MIN_SAMPLE_FOR_REPORTING);
        const strongest = reportable.sort((a, b) => b.nCorrect / b.nAnswered - a.nCorrect / a.nAnswered)[0];
        const weakest = reportable.sort((a, b) => a.nCorrect / a.nAnswered - b.nCorrect / b.nAnswered)[0];
        const weekStart = new Date();
        weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
        weekStart.setUTCHours(0, 0, 0, 0);
        const weekAnswered = await this.prisma.answer.count({
          where: { studentId: link.studentId, answeredAt: { gte: weekStart } },
        });
        const totalAnswered = stats.reduce((sum, s) => sum + s.nAnswered, 0);
        const totalCorrect = stats.reduce((sum, s) => sum + s.nCorrect, 0);
        const { compositeIndex, delta: compositeIndexDelta } = await this.reports.getCompositeSummary(link.studentId);
        return {
          studentId: link.studentId,
          name: link.student.user.name,
          streak: link.student.currentStreak,
          weekAnswered,
          weeklyTarget: 35,
          totalAnswered,
          totalCorrect,
          totalWrong: totalAnswered - totalCorrect,
          testDate: link.student.testDate,
          compositeIndex,
          compositeIndexDelta,
          topStrength: strongest ? { nameAr: strongest.label.nameAr, nameEn: strongest.label.nameEn, accuracy: strongest.nCorrect / strongest.nAnswered } : null,
          topWeakness: weakest ? { nameAr: weakest.label.nameAr, nameEn: weakest.label.nameEn, accuracy: weakest.nCorrect / weakest.nAnswered } : null,
        };
      }),
    );

    return { supervisorType: supervisor.type, viewMode: supervisor.type === 'parent' || cards.length <= 3 ? 'family_card' : 'instructor_table', students: cards };
  }

  // V3 in the spec — supervisor sets the weekly report day/time, or mutes it.
  getPreferences(supervisorId: string) {
    return this.prisma.supervisor.findUniqueOrThrow({
      where: { userId: supervisorId },
      select: { weeklyReportDay: true, weeklyReportHour: true, weeklyReportMuted: true },
    });
  }

  setPreferences(supervisorId: string, dto: { weeklyReportDay?: number; weeklyReportHour?: number; weeklyReportMuted?: boolean }) {
    return this.prisma.supervisor.update({ where: { userId: supervisorId }, data: dto });
  }
}
