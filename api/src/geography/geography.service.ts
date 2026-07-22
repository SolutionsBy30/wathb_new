import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GeographyService {
  constructor(private prisma: PrismaService) {}

  listRegions() {
    return this.prisma.region.findMany({ orderBy: { nameAr: 'asc' } });
  }

  listCities(regionId?: string) {
    return this.prisma.city.findMany({ where: { regionId }, orderBy: { nameAr: 'asc' } });
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

  createCity(regionId: string, nameAr: string, nameEn: string) {
    return this.prisma.city.create({ data: { regionId, nameAr, nameEn } });
  }

  createSchool(cityId: string, nameAr: string, nameEn?: string) {
    return this.prisma.school.create({ data: { cityId, nameAr, nameEn, status: 'approved' } });
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
