import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertAreaDto, UpsertLabelDto, UpsertSectionDto, UpsertTestDto } from './dto/taxonomy.dto';

@Injectable()
export class TaxonomyService {
  constructor(private prisma: PrismaService) {}

  listTests() {
    return this.prisma.test.findMany({ where: { isActive: true }, orderBy: { nameEn: 'asc' } });
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
}
