import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertPackageDto } from './dto/packages.dto';

@Injectable()
export class PackagesService {
  constructor(private prisma: PrismaService) {}

  listPublic() {
    return this.prisma.package.findMany({ where: { isActive: true, visibility: 'public' }, orderBy: { priceHalalas: 'asc' } });
  }

  listAll() {
    return this.prisma.package.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(dto: UpsertPackageDto) {
    return this.prisma.package.create({ data: dto });
  }

  update(id: string, dto: Partial<UpsertPackageDto>) {
    return this.prisma.package.update({ where: { id }, data: dto });
  }
}
