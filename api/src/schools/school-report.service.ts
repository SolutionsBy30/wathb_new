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
import { archivedTestIds, hasFinishedEverything } from '../reports/archive-scope.util';
import {
  AttemptScore,
  describeForecastAr,
  forecast,
  FORECAST_DISCLAIMER_AR,
  ScoreForecast,
  summariseForecasts,
} from '../simulation/score-forecast.util';

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
 * The forecast (SIM-023) is built from simulation attempts only — never from
 * daily practice. A simulation is sat under exam conditions, which is what
 * makes it worth forecasting from; daily accuracy measures a different thing
 * at a different difficulty and would flatter everyone.
 *
 * It is still not a Qiyas score, and every response says so: we have no
 * equating table, the same reason SimulationResult.scaledEstimate stays null.
 * What a school gets is the range this student has actually produced under
 * exam conditions, which is a defensible thing to plan around.
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
        // STU-036 — the test behind each stat, so exams the student has
        // already sat can be excluded. Without it a school's accuracy blends
        // a graduate's licensing exam into its قدرات cohort mean.
        labelStats: {
          select: {
            nAnswered: true,
            nCorrect: true,
            label: { select: { area: { select: { section: { select: { testId: true } } } } } },
          },
        },
        studentTests: { select: { testId: true, isActive: true, archivedAt: true } },
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

    // SIM-023 — every finalized simulation, not just the newest: the forecast
    // is built from the lowest, the highest and the most recent, so the whole
    // history is needed.
    const sims = ids.length
      ? await this.prisma.simulationAttempt.findMany({
          where: { studentId: { in: ids }, finalizedAt: { not: null } },
          orderBy: { finalizedAt: 'asc' },
          select: { studentId: true, finalizedAt: true, result: { select: { rawScore: true, scoredCount: true } } },
        })
      : [];
    const attemptsByStudent = new Map<string, AttemptScore[]>();
    for (const a of sims) {
      if (!a.result || a.result.scoredCount === 0 || !a.finalizedAt) continue;
      const list = attemptsByStudent.get(a.studentId) ?? [];
      list.push({
        accuracy: Math.round((a.result.rawScore / a.result.scoredCount) * 1000) / 10,
        finalizedAt: a.finalizedAt,
      });
      attemptsByStudent.set(a.studentId, list);
    }

    const mapped = students.map((s) => {
      // STU-036 — a sat exam keeps its history and loses its vote here.
      const archived = archivedTestIds(s.studentTests);
      const live = s.labelStats.filter((l) => !archived.has(l.label.area.section.testId));
      const answered = live.reduce((n, l) => n + l.nAnswered, 0);
      const correct = live.reduce((n, l) => n + l.nCorrect, 0);
      const f = forecast(attemptsByStudent.get(s.userId) ?? []);
      return {
        student: s,
        forecast: f,
        // Everything they were preparing for has been sat: they leave the
        // cohort entirely rather than appearing as a row with nothing behind
        // it. After the exam, readiness is no longer a question about them.
        finished: hasFinishedEverything(s.studentTests),
        row: {
          studentId: s.userId,
          accuracy: answered > 0 ? Math.round((correct / answered) * 1000) / 10 : null,
          answered,
          completedLeaps: leapsByStudent.get(s.userId) ?? 0,
          lastActiveAt: s.lastCompletedOn,
          simulationAccuracy: f?.likely ?? null,
        } satisfies StudentRow,
      };
    });

    // Filtered here rather than at each caller, so no consumer can forget and
    // quietly report a cohort that includes people who have already sat.
    const live = mapped.filter((m) => !m.finished);
    return { rows: live, finishedCount: mapped.length - live.length };
  }

  /** The dashboard's headline: how the cohort stands, and who needs attention. */
  async overview(userId: string, schoolId: string) {
    const school = await this.assertAccess(userId, schoolId);
    const { rows, finishedCount } = await this.studentRows(schoolId);
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
        forecast: summariseForecasts([]),
        students: [],
        disclaimerAr: READINESS_DISCLAIMER_AR,
        forecastDisclaimerAr: FORECAST_DISCLAIMER_AR,
      };
    }

    const cohortForecast = summariseForecasts(rows.map((r) => r.forecast));

    const students = rows
      .map(({ student, row, forecast: f }) => {
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
          // SIM-023 — null when they have never sat a simulation. The client
          // shows "لم يجرِ المحاكي" rather than a zero, which would read as a
          // prediction of failure.
          forecast: f,
          forecastNoteAr: f ? describeForecastAr(f) : null,
        };
      })
      // Sorted by the forecast floor where there is one, then by daily
      // accuracy: this screen exists to find who needs a class, and the floor
      // is the number that decides that.
      .sort((a, b) => (a.forecast?.low ?? a.accuracy ?? 999) - (b.forecast?.low ?? b.accuracy ?? 999));

    return {
      school: { id: school.id, nameAr: school.nameAr, disclosure },
      summary,
      forecast: cohortForecast,
      suppressed: null,
      // STU-036 — named, not hidden. A roster that shrinks with no explanation
      // reads as lost data; "12 students have sat their exam" reads as
      // progress, which is what it is.
      finishedCount,
      finishedNoteAr: finishedCount > 0
        ? `${finishedCount} من طلاب المدرسة أدّوا اختبارهم الفعلي، ولم يعودوا ضمن الأرقام أدناه.`
        : null,
      students,
      disclaimerAr: READINESS_DISCLAIMER_AR,
      forecastDisclaimerAr: FORECAST_DISCLAIMER_AR,
    };
  }

  /**
   * SCH-008 — the same cohort picture for a وثب admin, who has no SchoolAdmin
   * link and needs none: they can already open any student's full record on
   * the students screen.
   *
   * Aggregates only — bands, areas, cohort forecast, attention counts. No
   * per-student rows, so this endpoint adds no way to read a named student
   * that the 'students' permission does not already govern. An admin holding
   * only 'geography' gets the shape of a school, not its roster.
   *
   * The cohort floor is reported rather than enforced: an admin investigating
   * "why does this school see nothing?" needs the real numbers to answer it,
   * and `schoolSees` says exactly what the school is being shown instead.
   */
  async adminCohortReport(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        id: true,
        nameAr: true,
        status: true,
        identityDisclosure: true,
        city: { select: { nameAr: true, region: { select: { nameAr: true } } } },
      },
    });
    if (!school) throw new NotFoundException('المدرسة غير موجودة');

    const { rows } = await this.studentRows(schoolId);
    const summary = summarise(rows.map((r) => r.row));
    const areas = await this.areaAggregate(schoolId);

    const optedOut = rows.filter((r) => r.student.schoolShareOptOutAt !== null).length;
    const consented = rows.filter((r) => r.student.schoolShareConsentAt !== null).length;

    return {
      school: {
        id: school.id,
        nameAr: school.nameAr,
        status: school.status,
        cityNameAr: school.city.nameAr,
        regionNameAr: school.city.region.nameAr,
        disclosure: school.identityDisclosure as Disclosure,
      },
      summary,
      forecast: summariseForecasts(rows.map((r) => r.forecast)),
      areas,
      attention: {
        struggling: rows.filter(({ row }) => ['at_risk', 'needs_support'].includes(readinessBand(row.accuracy, row.answered))).length,
        inactive: rows.filter(({ row }) => row.answered < MIN_ANSWERS_FOR_BAND).length,
        volatile: rows.filter(({ forecast: f }) => f?.volatile).length,
        neverSimulated: rows.filter(({ forecast: f }) => f === null).length,
      },
      // What this school is actually being shown right now, which is the
      // question a support call is usually about.
      schoolSees: {
        reportable: isReportable(summary.students),
        minStudents: MIN_COHORT_STUDENTS,
        disclosure: school.identityDisclosure as Disclosure,
        namesVisible:
          school.identityDisclosure === 'full'
            ? summary.students - optedOut
            : school.identityDisclosure === 'consented'
              ? rows.filter((r) => canRevealIdentity('consented', {
                  studentId: r.student.userId,
                  optedOutAt: r.student.schoolShareOptOutAt,
                  consentedAt: r.student.schoolShareConsentAt,
                })).length
              : 0,
        optedOut,
        consented,
      },
      disclaimerAr: READINESS_DISCLAIMER_AR,
      forecastDisclaimerAr: FORECAST_DISCLAIMER_AR,
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

    return { areas: await this.areaAggregate(schoolId), suppressed: null, disclaimerAr: READINESS_DISCLAIMER_AR };
  }

  /**
   * Accuracy by area for one school, weakest first.
   *
   * Shared by the school's own breakdown and the admin report so the two can
   * never disagree — a support call where the admin console and the school
   * dashboard quote different numbers is worse than either being wrong.
   *
   * The per-area floor stays in both: an area only a handful of students ever
   * touched reports their accuracy, not the school's, whoever is reading.
   */
  private async areaAggregate(schoolId: string) {
    const students = await this.prisma.student.findMany({ where: { schoolId }, select: { userId: true } });
    const ids = students.map((s) => s.userId);
    if (ids.length === 0) return [];

    const [stats, archivedRows] = await Promise.all([
      this.prisma.studentLabelStat.findMany({
        where: { studentId: { in: ids } },
        select: {
          studentId: true,
          nAnswered: true,
          nCorrect: true,
          label: { select: { area: { select: { id: true, nameAr: true, section: { select: { nameAr: true, testId: true } } } } } },
        },
      }),
      // STU-036 — same exclusion as the per-student rows, or a school's area
      // breakdown would still carry exams its students have finished.
      this.prisma.studentTest.findMany({
        where: { studentId: { in: ids }, archivedAt: { not: null } },
        select: { studentId: true, testId: true },
      }),
    ]);
    const archivedByStudent = new Map<string, Set<string>>();
    for (const r of archivedRows) {
      const set = archivedByStudent.get(r.studentId) ?? new Set<string>();
      set.add(r.testId);
      archivedByStudent.set(r.studentId, set);
    }

    const agg = new Map<string, { nameAr: string; sectionNameAr: string; answered: number; correct: number; students: Set<string> }>();
    for (const s of stats) {
      if (s.nAnswered === 0) continue;
      if (archivedByStudent.get(s.studentId)?.has(s.label.area.section.testId)) continue;
      const a = s.label.area;
      const cur = agg.get(a.id) ?? { nameAr: a.nameAr, sectionNameAr: a.section.nameAr, answered: 0, correct: 0, students: new Set<string>() };
      cur.answered += s.nAnswered;
      cur.correct += s.nCorrect;
      cur.students.add(s.studentId);
      agg.set(a.id, cur);
    }

    return [...agg.entries()]
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
    const { rows } = await this.studentRows(schoolId);
    const disclosure = school.identityDisclosure as Disclosure;

    if (!isReportable(rows.length)) {
      return {
        struggling: [],
        inactive: [],
        volatile: [],
        byForecastFloor: [],
        cohortForecast: summariseForecasts([]),
        suppressed: { reason: 'cohort_too_small' as const },
        disclaimerAr: READINESS_DISCLAIMER_AR,
        forecastDisclaimerAr: FORECAST_DISCLAIMER_AR,
      };
    }

    const present = ({ student, row, forecast: f }: { student: any; row: StudentRow; forecast: ScoreForecast | null }) => ({
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
      forecast: f,
      forecastNoteAr: f ? describeForecastAr(f) : null,
    });

    const struggling = rows
      .filter(({ row }) => ['at_risk', 'needs_support'].includes(readinessBand(row.accuracy, row.answered)))
      .map(present)
      .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0));

    const inactive = rows
      .filter(({ row }) => row.answered < MIN_ANSWERS_FOR_BAND)
      .map(present)
      .sort((a, b) => a.answered - b.answered);

    // SIM-023 — a third list, because it needs a third response. A student
    // swinging 20 points between simulations does not need more content; they
    // need exam technique — pacing, nerves, not running out of time. Reading
    // them as "struggling" would send them to the wrong class.
    const volatile = rows
      .filter(({ forecast: f }) => f?.volatile)
      .map(present)
      .sort((a, b) => (b.forecast?.spread ?? 0) - (a.forecast?.spread ?? 0));

    // Below the forecast floor: a school planning for its students' good days
    // is planning for the wrong day.
    const atRiskOnFloor = rows
      .filter(({ forecast: f }) => f !== null)
      .map(present)
      .sort((a, b) => (a.forecast!.low ?? 0) - (b.forecast!.low ?? 0))
      .slice(0, 20);

    return {
      struggling,
      inactive,
      volatile,
      byForecastFloor: atRiskOnFloor,
      cohortForecast: summariseForecasts(rows.map((r) => r.forecast)),
      suppressed: null,
      disclaimerAr: READINESS_DISCLAIMER_AR,
      forecastDisclaimerAr: FORECAST_DISCLAIMER_AR,
    };
  }
}
