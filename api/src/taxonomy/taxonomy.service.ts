import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { deletionBlockers, refusalMessageAr, TestUsage } from './test-deletion.util';
import { UpsertAreaDto, UpsertLabelDto, UpsertSectionDto, UpsertTestDto, UpsertTestGroupDto } from './dto/taxonomy.dto';

@Injectable()
export class TaxonomyService {
  constructor(private prisma: PrismaService) {}

  listTests() {
    return this.prisma.test.findMany({
      where: { isActive: true },
      orderBy: { nameEn: 'asc' },
      // ADM-094 — the group travels with the test so every picker can segment
      // its list without a second request. Null for an ungrouped test, which
      // clients render as "غير مصنّف" rather than hiding.
      include: { group: { select: { id: true, nameAr: true, nameEn: true, sort: true } } },
    });
  }

  // Admin management needs deactivated tests too — the public picker above
  // hides them, which would otherwise make deactivation a one-way door.
  listAllTests() {
    return this.prisma.test.findMany({
      orderBy: { nameEn: 'asc' },
      include: { group: { select: { id: true, nameAr: true, nameEn: true, sort: true } } },
    });
  }

  /**
   * ADM-094 — the catalogue's segments.
   *
   * Ordered by `sort` then name so an admin can put the segment most of their
   * students want first, rather than living with alphabetical order.
   */
  listGroups(includeInactive = false) {
    return this.prisma.testGroup.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ sort: 'asc' }, { nameAr: 'asc' }],
      include: { _count: { select: { tests: true } } },
    });
  }

  createGroup(dto: UpsertTestGroupDto) {
    return this.prisma.testGroup.create({ data: dto });
  }

  updateGroup(id: string, dto: Partial<UpsertTestGroupDto>) {
    return this.prisma.testGroup.update({ where: { id }, data: dto });
  }

  /**
   * ADM-014/ADM-094 — same discipline as deleting a section: refuse while it
   * still holds tests rather than cascading.
   *
   * The foreign key is SET NULL, so a delete here would silently ungroup a
   * catalogue's worth of tests and look like nothing happened. Deactivating is
   * the reversible way to retire a segment, and the message says so.
   */
  async deleteGroup(id: string) {
    const count = await this.prisma.test.count({ where: { groupId: id } });
    if (count > 0) {
      throw new BadRequestException(
        `لا يمكن حذف المجموعة وبها ${count} اختبار. انقل الاختبارات إلى مجموعة أخرى أولًا، أو عطّل المجموعة بدل حذفها.`,
      );
    }
    return this.prisma.testGroup.delete({ where: { id } });
  }

  async tree(testId: string) {
    const test = await this.prisma.test.findUnique({
      where: { id: testId },
      include: {
        sections: {
          orderBy: { sort: 'asc' },
          include: {
            areas: {
              orderBy: { sort: 'asc' },
              include: { labels: { orderBy: { sort: 'asc' } } },
            },
          },
        },
      },
    });
    if (!test) throw new BadRequestException('test not found');
    return test;
  }

  /**
   * ADM-093 — the whole taxonomy flattened to one row per label:
   * الاختبار ← القسم ← المجال ← التصنيف, with the question counts under each.
   *
   * LEFT joins throughout (Prisma nested includes are already outer), unlike
   * scripts/taxonomy-export.sql, whose inner JOINs silently drop a test with
   * no sections yet or an area with no labels — exactly the empty branches
   * someone auditing the tree needs to see.
   *
   * Retired labels are included and flagged rather than filtered: they still
   * hold questions, so omitting them would make the counts fail to add up.
   */
  async exportRows() {
    const [tests, counts] = await Promise.all([
      this.prisma.test.findMany({
        orderBy: { nameAr: 'asc' },
        include: {
          sections: {
            orderBy: [{ sort: 'asc' }, { nameAr: 'asc' }],
            include: {
              areas: {
                orderBy: [{ sort: 'asc' }, { nameAr: 'asc' }],
                include: { labels: { orderBy: [{ sort: 'asc' }, { nameAr: 'asc' }] } },
              },
            },
          },
        },
      }),
      this.prisma.question.groupBy({ by: ['labelId', 'status'], _count: { _all: true } }),
    ]);

    // One grouped query rather than a count per label: a few thousand labels
    // would otherwise be a few thousand round trips.
    const byLabel = new Map<string, Record<string, number>>();
    for (const c of counts) {
      const row = byLabel.get(c.labelId) ?? {};
      row[c.status] = c._count._all;
      byLabel.set(c.labelId, row);
    }

    const rows: Record<string, unknown>[] = [];
    for (const t of tests) {
      if (t.sections.length === 0) {
        rows.push(this.exportRow(t, null, null, null, {}));
        continue;
      }
      for (const s of t.sections) {
        if (s.areas.length === 0) {
          rows.push(this.exportRow(t, s, null, null, {}));
          continue;
        }
        for (const a of s.areas) {
          if (a.labels.length === 0) {
            rows.push(this.exportRow(t, s, a, null, {}));
            continue;
          }
          for (const l of a.labels) {
            rows.push(this.exportRow(t, s, a, l, byLabel.get(l.id) ?? {}));
          }
        }
      }
    }
    return rows;
  }

  private exportRow(t: any, s: any, a: any, l: any, counts: Record<string, number>) {
    const published = counts['published'] ?? 0;
    const draft = counts['draft'] ?? 0;
    const inReview = counts['in_review'] ?? 0;
    const retired = counts['retired'] ?? 0;
    return {
      test_ar: t.nameAr,
      test_en: t.nameEn,
      test_lang: t.language,
      test_active: t.isActive,
      section_ar: s?.nameAr ?? '',
      section_en: s?.nameEn ?? '',
      section_weight: s?.weight ?? '',
      section_sort: s?.sort ?? '',
      area_ar: a?.nameAr ?? '',
      area_en: a?.nameEn ?? '',
      area_sort: a?.sort ?? '',
      label_ar: l?.nameAr ?? '',
      label_en: l?.nameEn ?? '',
      label_sort: l?.sort ?? '',
      time_limit_s: l?.defaultTimeLimitS ?? '',
      label_retired: l ? l.isRetired : '',
      // The bulk importer takes this as its destination, which is the main
      // reason anyone exports this sheet.
      label_id: l?.id ?? '',
      q_published: published,
      q_draft: draft,
      q_in_review: inReview,
      q_retired: retired,
      q_total: published + draft + inReview + retired,
    };
  }

  createTest(dto: UpsertTestDto) {
    return this.prisma.test.create({ data: dto });
  }

  updateTest(id: string, dto: Partial<UpsertTestDto>) {
    // ADM-012 — language is chosen once at creation, never edited: every
    // name and question beneath the test is authored assuming a fixed
    // content language, so changing it later would silently mismatch
    // existing content against a new direction/language expectation.
    const { language, ...editable } = dto;
    return this.prisma.test.update({ where: { id }, data: editable });
  }

  /**
   * ADM-095 — everything attached to a test, for the delete guard and for the
   * console to show *before* anyone clicks delete.
   */
  async testUsage(id: string): Promise<TestUsage> {
    const [questions, targetingStudents, studentTests, wathbs, blueprints, packages] = await Promise.all([
      // Questions hang off labels, three levels below the test.
      this.prisma.question.count({ where: { label: { area: { section: { testId: id } } } } }),
      this.prisma.student.count({ where: { targetTestId: id } }),
      this.prisma.studentTest.count({ where: { testId: id } }),
      this.prisma.wathb.count({ where: { testId: id } }),
      this.prisma.simulationBlueprint.count({ where: { testId: id } }),
      // testIds is a String[] with no foreign key, so this is the only thing
      // standing between a delete and a dangling id inside a package.
      this.prisma.package.findMany({
        where: { testIds: { has: id } },
        select: { nameAr: true, _count: { select: { subscriptions: true } } },
      }),
    ]);

    return {
      questions,
      targetingStudents,
      studentTests,
      wathbs,
      blueprints,
      packages: packages.map((p) => ({ nameAr: p.nameAr, subscriptions: p._count.subscriptions })),
    };
  }

  /**
   * ADM-095 — delete a test, but only one nothing is attached to.
   *
   * The cascades make this genuinely dangerous: Section.test, Area.section and
   * Label.area all cascade, so an unguarded delete takes the entire taxonomy
   * with it, and StudentTest.test cascades too, quietly discarding enrolments.
   * Question.label restricts, so a populated tree aborts mid-cascade with a
   * raw foreign-key error rather than anything an admin could act on.
   *
   * Hence: gather everything, refuse with the whole list, and point at
   * deactivation — which is what is actually wanted in nearly every case.
   */
  async deleteTest(id: string) {
    const test = await this.prisma.test.findUnique({ where: { id }, select: { id: true, nameAr: true } });
    if (!test) throw new NotFoundException('الاختبار غير موجود');

    const usage = await this.testUsage(id);
    const blockers = deletionBlockers(usage);
    if (blockers.length > 0) {
      throw new BadRequestException(refusalMessageAr(test.nameAr, blockers));
    }

    // Only empty sections/areas/labels remain, which the cascade removes.
    await this.prisma.test.delete({ where: { id } });
    return { deleted: true, nameAr: test.nameAr };
  }

  async createSection(testId: string, dto: UpsertSectionDto) {
    return this.prisma.section.create({ data: { ...dto, testId } });
  }

  updateSection(id: string, dto: Partial<UpsertSectionDto>) {
    return this.prisma.section.update({ where: { id }, data: dto });
  }

  async createArea(sectionId: string, dto: UpsertAreaDto) {
    return this.prisma.area.create({ data: { ...dto, sectionId } });
  }

  updateArea(id: string, dto: Partial<UpsertAreaDto>) {
    return this.prisma.area.update({ where: { id }, data: dto });
  }

  async createLabel(areaId: string, dto: UpsertLabelDto) {
    return this.prisma.label.create({ data: { ...dto, areaId } });
  }

  updateLabel(id: string, dto: Partial<UpsertLabelDto>) {
    return this.prisma.label.update({ where: { id }, data: dto });
  }

  // A label with questions attached cannot be hard-deleted — retire it instead
  // and require the admin to reassign or retire its questions explicitly.
  async retireLabel(id: string) {
    const questionCount = await this.prisma.question.count({
      where: { labelId: id, status: { not: 'retired' } },
    });
    await this.prisma.label.update({ where: { id }, data: { isRetired: true } });
    return { retired: true, activeQuestionsNeedingReassignment: questionCount };
  }

  /**
   * ADM-014 — delete an empty section/area.
   *
   * Section → Area → Label all cascade, so deleting a section takes its whole
   * subtree with it. That is fine for a mistyped branch and catastrophic for a
   * populated one: the cascade would also take `StudentLabelStat`, which is
   * where every student's per-label performance history lives, and that is not
   * reconstructible from anything else.
   *
   * So the guard is content-based rather than trusting the database's own
   * referential actions. `Question.label` is `Restrict`, which means Postgres
   * *would* refuse a populated delete — but only with an opaque foreign-key
   * error, and only after the cascade had already decided to take the stats.
   * Counting first turns that into a sentence an admin can act on.
   *
   * A branch that still holds questions is retired label-by-label instead, so
   * the questions and their answer history survive the structure changing.
   */
  private async assertDeletable(kind: 'section' | 'area', questionCount: number, labelCount: number) {
    if (questionCount > 0) {
      throw new BadRequestException(
        `cannot delete this ${kind}: ${questionCount} question(s) still live beneath it. ` +
          `Move them to another label, or retire the labels instead — deleting would destroy ` +
          `their per-student performance history.`,
      );
    }
    return labelCount;
  }

  async deleteSection(id: string) {
    const section = await this.prisma.section.findUnique({
      where: { id },
      include: { areas: { include: { labels: { select: { id: true } } } } },
    });
    if (!section) throw new BadRequestException('section not found');
    const questionCount = await this.prisma.question.count({
      where: { label: { area: { sectionId: id } } },
    });
    const labelCount = section.areas.reduce((n, a) => n + a.labels.length, 0);
    await this.assertDeletable('section', questionCount, labelCount);
    await this.prisma.section.delete({ where: { id } });
    return { deleted: true, areasRemoved: section.areas.length, labelsRemoved: labelCount };
  }

  /**
   * ADM-095 — hard-delete a label that has never held a question.
   *
   * The sibling of retireLabel, not a replacement for it. Retiring keeps the
   * row and its history and merely takes it out of circulation; deleting
   * removes it outright, which is only ever right for a label created by
   * mistake — a typo, a duplicate, a branch that was restructured before any
   * content landed under it.
   *
   * The guard counts questions of ANY status, including retired ones, unlike
   * retireLabel which only counts the active ones. A retired question still
   * carries answers, and Label → StudentLabelStat cascades, so deleting a
   * label with retired questions beneath it would silently destroy per-student
   * performance history that nothing else can reconstruct.
   */
  async deleteLabel(id: string) {
    const label = await this.prisma.label.findUnique({ where: { id } });
    if (!label) throw new BadRequestException('label not found');

    const questionCount = await this.prisma.question.count({ where: { labelId: id } });
    if (questionCount > 0) {
      throw new BadRequestException(
        `cannot delete this label: ${questionCount} question(s) are filed under it ` +
          `(retired ones included). Move them to another label, or retire this label ` +
          `instead — deleting would destroy their per-student performance history.`,
      );
    }

    // Answered questions are covered above, but a label can also accumulate
    // stat rows without live questions (a question moved away afterwards), and
    // those are the history itself.
    const statCount = await this.prisma.studentLabelStat.count({ where: { labelId: id } });
    if (statCount > 0) {
      throw new BadRequestException(
        `cannot delete this label: ${statCount} student performance record(s) reference it. ` +
          `Retire it instead — deleting would destroy that history.`,
      );
    }

    await this.prisma.label.delete({ where: { id } });
    return { deleted: true };
  }

  async deleteArea(id: string) {
    const area = await this.prisma.area.findUnique({
      where: { id },
      include: { labels: { select: { id: true } } },
    });
    if (!area) throw new BadRequestException('area not found');
    const questionCount = await this.prisma.question.count({ where: { label: { areaId: id } } });
    await this.assertDeletable('area', questionCount, area.labels.length);
    await this.prisma.area.delete({ where: { id } });
    return { deleted: true, labelsRemoved: area.labels.length };
  }
}
