import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  aliasFor,
  canRevealIdentity,
  Disclosure,
  isReportable,
  MIN_ANSWERS_FOR_BAND,
  MIN_COHORT_STUDENTS,
  MIN_STUDENTS_PER_AREA,
  readinessBand,
  READINESS_DISCLAIMER_AR,
  StudentRow,
  summarise,
} from './school-insights.util';

/**
 * SCH-003 — the school dashboard's data.
 *
 * The school is not the student's guardian and did not collect this data, so
 * everything here starts closed and opens only on an explicit decision:
 *
 *  - names are replaced by stable per-school aliases unless disclosure is on
 *    AND the student has not refused;
 *  - contact details are never returned at all, at any disclosure level — a
 *    school that needs to reach a student has its own records;
 *  - breakdowns are suppressed below a cohort floor, because a mean over four
 *    students beside a list of four aliases identifies all four.
 *
 * Nothing here predicts a Qiyas score. We have no equating table — the same
 * reason SimulationResult.scaledEstimate stays null — and a predicted number
 * on this screen is one a school would place students into classes on.
 */
@Injectable()
export class SchoolReportService {
  constructor(private prisma: PrismaService) {}

  /** The schools this session may read, and nothing else. */
  async schoolsFor(userId: string) {
    const rows = await this.prisma.schoolAdmin.findMany({
      where: { userId, isActive: true },
      include: { school: { select: { id: true, nameAr: true, identityDisclosure: true, city: { select: { nameAr: true } } } } },
    });
    return rows.map((r) => ({
      schoolId: r.school.id,
      nameAr: r.school.nameAr,
      cityNameAr: r.school.city.nameAr,
      disclosure: r.school.identityDisclosure as Disclosure,
      title: r.title,
    }));
  }

  /**
   * Every read goes through here. A school id in a URL is not a capability:
   * without this check any school administrator could read any school by
   * editing the path.
   */
  private async assertAccess(userId: string, schoolId: string) {
    const link = await this.prisma.schoolAdmin.findFirst({
      where: { userId, schoolId, isActive: true },
      include: { school: true },
    });
    if (!link) throw new ForbiddenException('ليست مدرستك.');
    await this.prisma.schoolAdmin.update({ where: { id: link.id }, data: { lastSeenAt: new Date() } });
    return link.school;
  }

  /**
   * Per-student rows, already anonymised.
   *
   * Accuracy is lifetime over answered questions rather than a windowed
   * figure: a school planning support classes cares where a student stands
   * now, and a 30-day window on a student who paused for a fortnight reads as
   * a collapse rather than a gap.
   */
  private async studentRows(schoolId: string) {
    const students = await this.prisma.student.findMany({
      where: { schoolId },
      select: {
        userId: true,
        schoolShareConsentAt: true,
        schoolShareOptOutAt: true,
        lastCompletedOn: true,
        currentStreak: true,
        user: { select: { name: true } },
        labelStats: { select: { nAnswered: true, nCorrect: true } },
      },
    });

    const ids = students.map((s) => s.userId);
    const completed = ids.length
      ? await this.prisma.wathb.groupBy({
          by: ['studentId'],
          where: { studentId: { in: ids }, status: 'completed', bundleType: { not: 'placement' } },
          _count: { _all: true },
        })
      : [];
    const leapsByStudent = new Map(completed.map((c) => [c.studentId, c._count._all]));

    // Latest simulation percentage, where one exists. Closest thing we have to
    // an exam-condition signal, and far more informative than daily practice.
    const sims = ids.length
      ? await this.prisma.simulationAttempt.findMany({
          where: { studentId: { in: ids }, finalizedAt: { not: null } },
          orderBy: { finalizedAt: 'desc' },
          select: { studentId: true, result: { select: { rawScore: true, scoredCount: true } } },
        })
      : [];
    const simByStudent = new Map<string, number>();
    for (const a of sims) {
      if (simByStudent.has(a.studentId) || !a.result || a.result.scoredCount === 0) continue;
      simByStudent.set(a.studentId, Math.round((a.result.rawScore / a.result.scoredCount) * 1000) / 10);
    }

    return students.map((s) => {
      const answered = s.labelStats.reduce((n, l) => n + l.nAnswered, 0);
      const correct = s.labelStats.reduce((n, l) => n + l.nCorrect, 0);
      return {
        student: s,
        row: {
          studentId: s.userId,
          accuracy: answered > 0 ? Math.round((correct / answered) * 1000) / 10 : null,
          answered,
          completedLeaps: leapsByStudent.get(s.userId) ?? 0,
          lastActiveAt: s.lastCompletedOn,
          simulationAccuracy: simByStudent.get(s.userId) ?? null,
        } satisfies StudentRow,
      };
    });
  }

  /** The dashboard's headline: how the cohort stands, and who needs attention. */
  async overview(userId: string, schoolId: string) {
    const school = await this.assertAccess(userId, schoolId);
    const rows = await this.studentRows(schoolId);
    const disclosure = school.identityDisclosure as Disclosure;

    const summary = summarise(rows.map((r) => r.row));

    // Below the floor the school still sees its own headcount — hiding that
    // would just look broken — but no averages and no per-student rows.
    if (!isReportable(summary.students)) {
      return {
        school: { id: school.id, nameAr: school.nameAr, disclosure },
        summary: { students: summary.students, measured: 0, meanAccuracy: null, medianAccuracy: null, bands: summary.bands },
        suppressed: {
          reason: 'cohort_too_small' as const,
          messageAr: `تظهر النتائج التفصيلية عند تسجيل ${MIN_COHORT_STUDENTS} طالبًا على الأقل من المدرسة. المسجّلون حاليًا: ${summary.students}.`,
        },
        students: [],
        disclaimerAr: READINESS_DISCLAIMER_AR,
      };
    }

    const students = rows
      .map(({ student, row }) => {
        const named = canRevealIdentity(disclosure, {
          studentId: student.userId,
          optedOutAt: student.schoolShareOptOutAt,
          consentedAt: student.schoolShareConsentAt,
        });
        return {
          // The id is the alias, not the student id: a school dashboard has no
          // use for a real id, and shipping one makes every other endpoint a
          // lookup away.
          ref: aliasFor(student.userId, schoolId),
          // Null rather than absent, so the client renders "غير معلن" instead
          // of falling back to something that looks like a name.
          name: named ? student.user.name : null,
          accuracy: row.accuracy,
          answered: row.answered,
          completedLeaps: row.completedLeaps,
          simulationAccuracy: row.simulationAccuracy,
          lastActiveAt: row.lastActiveAt,
          band: readinessBand(row.accuracy, row.answered),
        };
      })
      // Weakest measured first: this screen exists to find who needs a class.
      .sort((a, b) => (a.accuracy ?? 999) - (b.accuracy ?? 999));

    return {
      school: { id: school.id, nameAr: school.nameAr, disclosure },
      summary,
      suppressed: null,
      students,
      disclaimerAr: READINESS_DISCLAIMER_AR,
    };
  }

  /**
   * Where the school as a whole is weak, by area — the answer to "which
   * classes should we run".
   *
   * Suppressed per area, not just per school: an area only four students ever
   * touched would otherwise report their combined accuracy as the school's.
   */
  async areaBreakdown(userId: string, schoolId: string) {
    await this.assertAccess(userId, schoolId);

    const students = await this.prisma.student.findMany({ where: { schoolId }, select: { userId: true } });
    if (!isReportable(students.length)) {
      return {
        areas: [],
        suppressed: {
          reason: 'cohort_too_small' as const,
          messageAr: `تظهر النتائج التفصيلية عند تسجيل ${MIN_COHORT_STUDENTS} طالبًا على الأقل من المدرسة.`,
        },
        disclaimerAr: READINESS_DISCLAIMER_AR,
      };
    }

    const ids = students.map((s) => s.userId);
    const stats = await this.prisma.studentLabelStat.findMany({
      where: { studentId: { in: ids } },
      select: {
        studentId: true,
        nAnswered: true,
        nCorrect: true,
        label: { select: { area: { select: { id: true, nameAr: true, section: { select: { nameAr: true } } } } } },
      },
    });

    const agg = new Map<string, { nameAr: string; sectionNameAr: string; answered: number; correct: number; students: Set<string> }>();
    for (const s of stats) {
      if (s.nAnswered === 0) continue;
      const a = s.label.area;
      const cur = agg.get(a.id) ?? { nameAr: a.nameAr, sectionNameAr: a.section.nameAr, answered: 0, correct: 0, students: new Set<string>() };
      cur.answered += s.nAnswered;
      cur.correct += s.nCorrect;
      cur.students.add(s.studentId);
      agg.set(a.id, cur);
    }

    const areas = [...agg.entries()]
      // An area a handful of students touched is not a finding about the
      // school, and its accuracy is effectively theirs alone.
      .filter(([, v]) => isReportable(v.students.size, MIN_STUDENTS_PER_AREA))
      .map(([areaId, v]) => ({
        areaId,
        areaNameAr: v.nameAr,
        sectionNameAr: v.sectionNameAr,
        students: v.students.size,
        answered: v.answered,
        accuracy: Math.round((v.correct / v.answered) * 1000) / 10,
      }))
      .sort((a, b) => a.accuracy - b.accuracy);

    return { areas, suppressed: null, disclaimerAr: READINESS_DISCLAIMER_AR };
  }

  /**
   * Students the school should look at first.
   *
   * Two separate lists, because they need different responses: someone
   * struggling with the material needs a class, and someone who has barely
   * practised needs chasing. Merging them into one "at risk" number is how a
   * school ends up tutoring a student whose real problem is that they never
   * opened the app.
   */
  async attentionList(userId: string, schoolId: string) {
    const school = await this.assertAccess(userId, schoolId);
    const rows = await this.studentRows(schoolId);
    const disclosure = school.identityDisclosure as Disclosure;

    if (!isReportable(rows.length)) {
      return { struggling: [], inactive: [], suppressed: { reason: 'cohort_too_small' as const }, disclaimerAr: READINESS_DISCLAIMER_AR };
    }

    const present = ({ student, row }: { student: any; row: StudentRow }) => ({
      ref: aliasFor(student.userId, schoolId),
      name: canRevealIdentity(disclosure, {
        studentId: student.userId,
        optedOutAt: student.schoolShareOptOutAt,
        consentedAt: student.schoolShareConsentAt,
      })
        ? student.user.name
        : null,
      accuracy: row.accuracy,
      answered: row.answered,
      completedLeaps: row.completedLeaps,
      lastActiveAt: row.lastActiveAt,
      band: readinessBand(row.accuracy, row.answered),
    });

    const struggling = rows
      .filter(({ row }) => ['at_risk', 'needs_support'].includes(readinessBand(row.accuracy, row.answered)))
      .map(present)
      .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0));

    const inactive = rows
      .filter(({ row }) => row.answered < MIN_ANSWERS_FOR_BAND)
      .map(present)
      .sort((a, b) => a.answered - b.answered);

    return { struggling, inactive, suppressed: null, disclaimerAr: READINESS_DISCLAIMER_AR };
  }
}
