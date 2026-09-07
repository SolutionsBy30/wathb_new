import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SimulationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../admin-ops/audit-log.service';
import { validateBlueprint } from './blueprint-validation.util';
import { BlueprintDto, SaveSectionsDto } from './dto/simulation.dto';

/**
 * SIM-004 — §9 blueprint editor.
 *
 * The blueprint is the whole point of the module: §11 acceptance criterion 11
 * requires a second test (التحصيلي) to run on this engine with configuration
 * only. So nothing here knows what القدرات is — section count, part names,
 * durations, quotas and gates are all data.
 */
@Injectable()
export class BlueprintService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditLogService,
  ) {}

  /** Sections and quotas always travel with the blueprint; the editor needs all three. */
  private readonly withSections = {
    sections: {
      orderBy: { orderIndex: 'asc' },
      include: { quotas: { include: { area: { select: { id: true, nameAr: true, sectionId: true } } } } },
    },
    test: { select: { id: true, nameAr: true } },
  } satisfies Prisma.SimulationBlueprintInclude;

  list(testId?: string) {
    return this.prisma.simulationBlueprint.findMany({
      where: testId ? { testId } : undefined,
      include: { test: { select: { id: true, nameAr: true } }, _count: { select: { forms: true, attempts: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string) {
    const bp = await this.prisma.simulationBlueprint.findUnique({ where: { id }, include: this.withSections });
    if (!bp) throw new NotFoundException('المخطط غير موجود');
    return bp;
  }

  async create(dto: BlueprintDto, adminUserId: string) {
    const test = await this.prisma.test.findUnique({ where: { id: dto.testId } });
    if (!test) throw new BadRequestException('الاختبار غير موجود');

    const bp = await this.prisma.simulationBlueprint.create({ data: this.toData(dto) });
    await this.audit.record({
      actorId: adminUserId,
      actorLabel: await this.label(adminUserId),
      action: 'simulation_blueprint_create',
      entityType: 'simulation_blueprint',
      entityId: bp.id,
      after: bp,
    });
    return bp;
  }

  async update(id: string, dto: BlueprintDto, adminUserId: string) {
    const before = await this.get(id);
    // A published blueprint has forms sitting under it whose section count and
    // question count are already materialised. Changing the shape underneath
    // them would leave a form that no longer matches its own blueprint, and
    // the runtime reads the blueprint for durations and navigation policy.
    if (before.status === 'published') {
      throw new BadRequestException('المخطط منشور — انسخه إلى مسودة جديدة بدل تعديله.');
    }

    const bp = await this.prisma.simulationBlueprint.update({ where: { id }, data: this.toData(dto) });
    await this.audit.record({
      actorId: adminUserId,
      actorLabel: await this.label(adminUserId),
      action: 'simulation_blueprint_update',
      entityType: 'simulation_blueprint',
      entityId: id,
      before,
      after: bp,
    });
    return bp;
  }

  /**
   * Sections and their quotas are saved as one unit, not row by row.
   *
   * A quota edit is only ever meaningful against the whole section set — the
   * sums have to balance — so a partial save would leave the blueprint
   * transiently invalid and let a concurrent publish read it mid-edit.
   */
  async saveSections(id: string, dto: SaveSectionsDto, adminUserId: string) {
    const before = await this.get(id);
    if (before.status === 'published') {
      throw new BadRequestException('المخطط منشور — انسخه إلى مسودة جديدة بدل تعديله.');
    }

    const areaIds = [...new Set(dto.sections.flatMap((s) => s.quotas.map((q) => q.areaId)))];
    const areas = await this.prisma.area.findMany({
      where: { id: { in: areaIds } },
      select: { id: true, section: { select: { testId: true } } },
    });
    if (areas.length !== areaIds.length) throw new BadRequestException('أحد المجالات غير موجود');
    // An area from another test would produce a form whose questions are not
    // from the test being simulated at all.
    const foreign = areas.find((a) => a.section.testId !== before.testId);
    if (foreign) throw new BadRequestException('أحد المجالات لا ينتمي إلى اختبار هذا المخطط');

    await this.prisma.$transaction(async (tx) => {
      // Cascade takes the quotas with the sections; rebuilding is simpler and
      // safer than diffing, and a blueprint has single-digit sections.
      await tx.simulationSectionTemplate.deleteMany({ where: { blueprintId: id } });
      for (const s of dto.sections) {
        await tx.simulationSectionTemplate.create({
          data: {
            blueprintId: id,
            orderIndex: s.orderIndex,
            part: s.part,
            questionCount: s.questionCount,
            durationS: s.durationS,
            experimentalSlots: [...new Set(s.experimentalSlots ?? [])],
            quotas: {
              create: s.quotas.map((q) => ({
                areaId: q.areaId,
                count: q.count,
                difficultyCurve: q.difficultyCurve ?? 'ascending',
              })),
            },
          },
        });
      }
    });

    await this.audit.record({
      actorId: adminUserId,
      actorLabel: await this.label(adminUserId),
      action: 'simulation_blueprint_sections',
      entityType: 'simulation_blueprint',
      entityId: id,
      before: before.sections,
      after: dto.sections,
    });
    return this.get(id);
  }

  /** §9 — clone, so a published blueprint can be revised without being edited. */
  async clone(id: string, adminUserId: string) {
    const src = await this.get(id);
    const copy = await this.prisma.$transaction(async (tx) => {
      const bp = await tx.simulationBlueprint.create({
        data: {
          testId: src.testId,
          mode: src.mode,
          nameAr: `${src.nameAr} (نسخة)`,
          nameEn: `${src.nameEn} (copy)`,
          totalQuestions: src.totalQuestions,
          sectionCount: src.sectionCount,
          sectionDurationS: src.sectionDurationS,
          breakBetweenSections: src.breakBetweenSections,
          breakDurationS: src.breakDurationS,
          navigationPolicy: src.navigationPolicy,
          allowFlagReview: src.allowFlagReview,
          calculatorAllowed: src.calculatorAllowed,
          scratchpad: src.scratchpad,
          difficultyOrdering: src.difficultyOrdering,
          experimentalCount: src.experimentalCount,
          minCompletedLeaps: src.minCompletedLeaps,
          minAnsweredQuestions: src.minAnsweredQuestions,
          minCoverageAreas: src.minCoverageAreas,
          minDaysBetweenAttempts: src.minDaysBetweenAttempts,
          minLeapsBetweenAttempts: src.minLeapsBetweenAttempts,
          requirePlacement: src.requirePlacement,
          status: 'draft',
        },
      });
      for (const s of src.sections) {
        await tx.simulationSectionTemplate.create({
          data: {
            blueprintId: bp.id,
            orderIndex: s.orderIndex,
            part: s.part,
            questionCount: s.questionCount,
            durationS: s.durationS,
            experimentalSlots: s.experimentalSlots,
            quotas: {
              create: s.quotas.map((q) => ({ areaId: q.areaId, count: q.count, difficultyCurve: q.difficultyCurve })),
            },
          },
        });
      }
      return bp;
    });

    await this.audit.record({
      actorId: adminUserId,
      actorLabel: await this.label(adminUserId),
      action: 'simulation_blueprint_clone',
      entityType: 'simulation_blueprint',
      entityId: copy.id,
      note: `نُسخ من ${id}`,
    });
    return this.get(copy.id);
  }

  /** The §9 arithmetic check, exposed on its own so the editor can show it live. */
  async validate(id: string) {
    const bp = await this.get(id);
    return validateBlueprint({
      totalQuestions: bp.totalQuestions,
      sectionCount: bp.sectionCount,
      experimentalCount: bp.experimentalCount,
      sections: bp.sections.map((s) => ({
        orderIndex: s.orderIndex,
        part: s.part,
        questionCount: s.questionCount,
        durationS: s.durationS,
        experimentalSlots: s.experimentalSlots,
        quotas: s.quotas.map((q) => ({ areaId: q.areaId, count: q.count, difficultyCurve: q.difficultyCurve })),
      })),
    });
  }

  async setStatus(id: string, status: SimulationStatus, adminUserId: string) {
    const bp = await this.get(id);

    if (status === 'published') {
      const issues = await this.validate(id);
      if (issues.length > 0) {
        throw new BadRequestException(`لا يمكن نشر المخطط: ${issues.map((i) => i.messageAr).join(' — ')}`);
      }
    }

    if (status === 'archived') {
      // Archiving a blueprint with a live attempt would strand that student:
      // the runtime reads durations and navigation policy from here.
      const live = await this.prisma.simulationAttempt.count({ where: { blueprintId: id, status: 'in_progress' } });
      if (live > 0) throw new BadRequestException(`لا يمكن الأرشفة: ${live} محاولة قيد التنفيذ الآن.`);
    }

    const updated = await this.prisma.simulationBlueprint.update({ where: { id }, data: { status } });
    await this.audit.record({
      actorId: adminUserId,
      actorLabel: await this.label(adminUserId),
      action: 'simulation_blueprint_status',
      entityType: 'simulation_blueprint',
      entityId: id,
      before: { status: bp.status },
      after: { status },
    });
    return updated;
  }

  async remove(id: string, adminUserId: string) {
    const bp = await this.get(id);
    const forms = await this.prisma.simulationForm.count({ where: { blueprintId: id } });
    if (forms > 0) throw new BadRequestException('للمخطط نماذج مكوَّنة — أرشفه بدل حذفه.');

    await this.prisma.simulationBlueprint.delete({ where: { id } });
    await this.audit.record({
      actorId: adminUserId,
      actorLabel: await this.label(adminUserId),
      action: 'simulation_blueprint_delete',
      entityType: 'simulation_blueprint',
      entityId: id,
      before: bp,
    });
    return { ok: true };
  }

  /** Audit rows carry a human label, not just a uuid — same as the other admin services. */
  private async label(adminUserId: string): Promise<string> {
    const admin = await this.prisma.user.findUnique({ where: { id: adminUserId }, select: { name: true, email: true } });
    return admin?.email ?? admin?.name ?? adminUserId;
  }

  private toData(dto: BlueprintDto) {
    return {
      testId: dto.testId,
      mode: dto.mode ?? 'computerized',
      nameAr: dto.nameAr,
      nameEn: dto.nameEn,
      totalQuestions: dto.totalQuestions,
      sectionCount: dto.sectionCount,
      sectionDurationS: dto.sectionDurationS ?? 1500,
      breakBetweenSections: dto.breakBetweenSections ?? false,
      breakDurationS: dto.breakDurationS ?? 0,
      navigationPolicy: dto.navigationPolicy ?? 'free_within_section',
      allowFlagReview: dto.allowFlagReview ?? true,
      calculatorAllowed: dto.calculatorAllowed ?? false,
      scratchpad: dto.scratchpad ?? 'digital',
      difficultyOrdering: dto.difficultyOrdering ?? 'ascending',
      experimentalCount: dto.experimentalCount ?? 4,
      minCompletedLeaps: dto.minCompletedLeaps ?? 20,
      minAnsweredQuestions: dto.minAnsweredQuestions ?? 100,
      minCoverageAreas: dto.minCoverageAreas ?? false,
      minDaysBetweenAttempts: dto.minDaysBetweenAttempts ?? 7,
      minLeapsBetweenAttempts: dto.minLeapsBetweenAttempts ?? 7,
      requirePlacement: dto.requirePlacement ?? true,
    };
  }
}
