import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertAreaDto, UpsertLabelDto, UpsertSectionDto, UpsertTestDto } from './dto/taxonomy.dto';

@Injectable()
export class TaxonomyService {
  constructor(private prisma: PrismaService) {}

  listTests() {
    return this.prisma.test.findMany({ where: { isActive: true }, orderBy: { nameEn: 'asc' } });
  }

  // Admin management needs deactivated tests too — the public picker above
  // hides them, which would otherwise make deactivation a one-way door.
  listAllTests() {
    return this.prisma.test.findMany({ orderBy: { nameEn: 'asc' } });
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
