import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GeographyService {
  constructor(private prisma: PrismaService) {}

  // Public pickers (signup, profile) only ever see active rows; admin
  // management screens pass includeInactive to manage what they've hidden.
  listRegions(includeInactive = false) {
    return this.prisma.region.findMany({ where: includeInactive ? undefined : { isActive: true }, orderBy: { nameAr: 'asc' } });
  }

  listCities(regionId?: string, includeInactive = false) {
    return this.prisma.city.findMany({
      where: { regionId, isActive: includeInactive ? undefined : true },
      include: includeInactive ? { aliases: true } : undefined,
      orderBy: { nameAr: 'asc' },
    });
  }

  listSchools(cityId?: string, search?: string) {
    return this.prisma.school.findMany({
      where: {
        cityId,
        status: 'approved',
        nameAr: search ? { contains: search, mode: 'insensitive' } : undefined,
      },
      include: { city: { include: { region: true } } },
      orderBy: { nameAr: 'asc' },
      take: 20,
    });
  }

  createRegion(nameAr: string, nameEn: string) {
    return this.prisma.region.create({ data: { nameAr, nameEn } });
  }

  updateRegion(id: string, dto: { nameAr?: string; nameEn?: string }) {
    return this.prisma.region.update({ where: { id }, data: dto });
  }

  setRegionActive(id: string, isActive: boolean) {
    return this.prisma.region.update({ where: { id }, data: { isActive } });
  }

  createCity(regionId: string, nameAr: string, nameEn: string) {
    return this.prisma.city.create({ data: { regionId, nameAr, nameEn } });
  }

  updateCity(id: string, dto: { nameAr?: string; nameEn?: string; regionId?: string }) {
    return this.prisma.city.update({ where: { id }, data: dto });
  }

  setCityActive(id: string, isActive: boolean) {
    return this.prisma.city.update({ where: { id }, data: { isActive } });
  }

  async addCityAlias(cityId: string, alias: string) {
    await this.prisma.city.findUniqueOrThrow({ where: { id: cityId } });
    return this.prisma.cityAlias.create({ data: { cityId, alias } });
  }

  removeCityAlias(id: string) {
    return this.prisma.cityAlias.delete({ where: { id } });
  }

  /**
   * ADM-063 — resolves a variant spelling to its canonical city, exact-match
   * on name or alias. Wrapped in { city } rather than returning the bare
   * row (or null) directly: a NestJS handler returning JS `null` serializes
   * to an empty 200 body, not a JSON `null`, which breaks res.json() on the
   * client for the "no match" case — wrapping sidesteps that entirely.
   */
  async resolveCity(name: string): Promise<{ city: { id: string; nameAr: string; nameEn: string; regionId: string; isActive: boolean } | null }> {
    const direct = await this.prisma.city.findFirst({ where: { OR: [{ nameAr: name }, { nameEn: name }] } });
    if (direct) return { city: direct };
    const viaAlias = await this.prisma.cityAlias.findUnique({ where: { alias: name }, include: { city: true } });
    return { city: viaAlias?.city ?? null };
  }

  createSchool(cityId: string, nameAr: string, nameEn?: string) {
    return this.prisma.school.create({ data: { cityId, nameAr, nameEn, status: 'approved' } });
  }

  updateSchool(id: string, dto: { nameAr?: string; nameEn?: string; cityId?: string }) {
    return this.prisma.school.update({ where: { id }, data: dto });
  }

  /**
   * ADM-064 — merge duplicate schools by repointing every enrolled
   * student to the surviving school, then removing the duplicate.
   * Answer/QuestionStats rows aren't keyed by school at all (school-level
   * performance is always computed live via a Student.schoolId join, see
   * ReportsService.getCohortReport) — the only thing to repoint is
   * Student.schoolId, so nothing else can be silently orphaned by a merge.
   */
  async mergeSchools(sourceId: string, targetId: string) {
    if (sourceId === targetId) throw new BadRequestException('cannot merge a school into itself');
    await this.prisma.school.findUniqueOrThrow({ where: { id: targetId } });
    const { count } = await this.prisma.student.updateMany({ where: { schoolId: sourceId }, data: { schoolId: targetId } });
    await this.prisma.school.delete({ where: { id: sourceId } });
    return { mergedStudents: count, survivingSchoolId: targetId };
  }

  /** Student self-declared suggestion — never inserted as approved directly (spec §3.4). */
  suggestSchool(cityId: string, nameAr: string, studentId: string) {
    return this.prisma.school.create({
      data: { cityId, nameAr, status: 'pending_review', suggestedByStudentId: studentId },
    });
  }

  listPendingSchools() {
    return this.prisma.school.findMany({
      where: { status: 'pending_review' },
      include: { city: { include: { region: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approveSchool(id: string) {
    const school = await this.prisma.school.findUnique({ where: { id } });
    if (!school) throw new NotFoundException('school not found');
    return this.prisma.school.update({ where: { id }, data: { status: 'approved' } });
  }

  async rejectSchool(id: string) {
    const school = await this.prisma.school.findUnique({ where: { id } });
    if (!school) throw new NotFoundException('school not found');
    return this.prisma.school.delete({ where: { id } });
  }
}
