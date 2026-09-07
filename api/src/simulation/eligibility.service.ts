import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { describeBlocks, evaluateEligibility, EligibilityResult, StudentGateFacts } from './eligibility.util';

export interface EntitlementState {
  /** The active subscription the attempt would draw from, if any. */
  subscriptionId: string | null;
  packageNameAr: string | null;
  included: number;
  used: number;
  remaining: number;
}

export interface SimulationAccess {
  blueprintId: string;
  eligibility: EligibilityResult;
  reasonsAr: string[];
  entitlement: EntitlementState;
  /** Everything true at once: gates cleared and an attempt left to spend. */
  canStart: boolean;
  /** The single blocking sentence to show, or null when they can start. */
  blockedAr: string | null;
}

/**
 * SIM-009 — §5.6 gates and §5.5 entitlement, against real data.
 *
 * The gate arithmetic lives in eligibility.util and is tested there. This is
 * only the part that needs a database: counting what the student has actually
 * done. Both are re-evaluated at POST /start, never trusted from the client
 * (acceptance criteria 7 and 8).
 *
 * Deliberately no `simulation_eligibility` table, despite §8 listing one. A
 * stored eligibility row is stale the moment the student completes a Wathba,
 * and every read path here already holds the facts the gates need — so a
 * cached copy would buy nothing and could disagree with the truth.
 */
@Injectable()
export class EligibilityService {
  constructor(private prisma: PrismaService) {}

  /**
   * §5.5 — attempts are counted, not decremented.
   *
   * A mutable counter drifts: a failed start, a crashed finalize or a
   * double-submitted request each leave it wrong with nothing to reconcile
   * against. Counting attempts that carry this subscription's id is derived
   * from the attempts themselves, so it cannot disagree with them — and "void
   * the attempt, refund the entitlement" (§7.4) is then just clearing
   * entitlementId, with no second number to keep in step.
   */
  async entitlement(studentId: string): Promise<EntitlementState> {
    const sub = await this.prisma.subscription.findFirst({
      where: { studentId, status: 'active' },
      include: { package: { select: { nameAr: true, simulationsIncluded: true } } },
      orderBy: { createdAt: 'desc' },
    });
    if (!sub) return { subscriptionId: null, packageNameAr: null, included: 0, used: 0, remaining: 0 };

    const used = await this.prisma.simulationAttempt.count({ where: { entitlementId: sub.id } });
    const included = sub.package.simulationsIncluded;
    return {
      subscriptionId: sub.id,
      packageNameAr: sub.package.nameAr,
      included,
      used,
      remaining: Math.max(0, included - used),
    };
  }

  async facts(studentId: string, blueprintId: string, testId: string): Promise<StudentGateFacts> {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentId },
      select: { placementDoneAt: true },
    });

    // §5.6 — "a Wathb counts as completed only if all its questions were
    // answered", which is exactly what the completed status means; `partial`
    // is a separate status and deliberately does not accrue.
    const completedLeaps = await this.prisma.wathb.count({
      where: { studentId, status: 'completed', bundleType: { not: 'placement' } },
    });

    const answeredQuestions = await this.prisma.answer.count({ where: { studentId } });

    // Areas covered, scoped to the test being simulated: practice on a
    // different test says nothing about readiness for this one.
    const covered = await this.prisma.answer.findMany({
      where: { studentId, question: { label: { area: { section: { testId } } } } },
      select: { question: { select: { label: { select: { areaId: true } } } } },
      distinct: ['questionId'],
    });
    const areasCovered = new Set(covered.map((a) => a.question.label.areaId)).size;

    // Gate B is per blueprint: a cooldown on القدرات should not lock التحصيلي.
    const last = await this.prisma.simulationAttempt.findFirst({
      where: { studentId, blueprintId, finalizedAt: { not: null } },
      orderBy: { finalizedAt: 'desc' },
      select: { finalizedAt: true },
    });

    const leapsSinceLastAttempt = last?.finalizedAt
      ? await this.prisma.wathb.count({
          where: {
            studentId,
            status: 'completed',
            bundleType: { not: 'placement' },
            completedAt: { gt: last.finalizedAt },
          },
        })
      : 0;

    const override = await this.prisma.simulationOverride.findFirst({
      where: { studentId, blueprintId, usedAt: null },
      select: { id: true },
    });

    return {
      completedLeaps,
      answeredQuestions,
      areasCovered,
      placementDoneAt: student?.placementDoneAt ?? null,
      lastAttemptFinalizedAt: last?.finalizedAt ?? null,
      leapsSinceLastAttempt,
      hasUnusedOverride: !!override,
    };
  }

  /** The whole picture for one student and one blueprint: gates + entitlement. */
  async access(studentId: string, blueprintId: string, now = new Date()): Promise<SimulationAccess> {
    const bp = await this.prisma.simulationBlueprint.findUniqueOrThrow({
      where: { id: blueprintId },
      select: {
        testId: true,
        minCompletedLeaps: true,
        minAnsweredQuestions: true,
        minCoverageAreas: true,
        minDaysBetweenAttempts: true,
        minLeapsBetweenAttempts: true,
        requirePlacement: true,
        sections: { select: { quotas: { select: { areaId: true } } } },
      },
    });

    // "Every area" means every area this blueprint actually draws from, not
    // every area in the test — requiring coverage of areas the simulation
    // never asks about would block students for no diagnostic reason.
    const totalAreas = new Set(bp.sections.flatMap((s) => s.quotas.map((q) => q.areaId))).size;

    const facts = await this.facts(studentId, blueprintId, bp.testId);
    const eligibility = evaluateEligibility(
      facts,
      {
        minCompletedLeaps: bp.minCompletedLeaps,
        minAnsweredQuestions: bp.minAnsweredQuestions,
        minCoverageAreas: bp.minCoverageAreas,
        minDaysBetweenAttempts: bp.minDaysBetweenAttempts,
        minLeapsBetweenAttempts: bp.minLeapsBetweenAttempts,
        requirePlacement: bp.requirePlacement,
        totalAreas,
      },
      now,
    );

    const entitlement = await this.entitlement(studentId);
    const reasonsAr = describeBlocks(eligibility);

    // Order matters in the message: a student blocked by both a gate and an
    // empty entitlement should hear about the gate first, because buying
    // something would not have helped (§5.6 — "no bypass by purchasing").
    let blockedAr: string | null = null;
    if (!eligibility.eligible) blockedAr = reasonsAr[0] ?? 'المحاكي غير متاح بعد.';
    else if (entitlement.included === 0) blockedAr = 'باقتك الحالية لا تشمل المحاكي.';
    else if (entitlement.remaining === 0) {
      blockedAr = `استهلكت محاولات المحاكي في باقتك (${entitlement.used} من ${entitlement.included}).`;
    }

    return {
      blueprintId,
      eligibility,
      reasonsAr,
      entitlement,
      canStart: blockedAr === null,
      blockedAr,
    };
  }
}
