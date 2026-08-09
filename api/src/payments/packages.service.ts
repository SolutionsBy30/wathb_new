import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertPackageDto } from './dto/packages.dto';

@Injectable()
export class PackagesService {
  constructor(private prisma: PrismaService) {}

  listPublic() {
    return this.prisma.package.findMany({ where: { isActive: true, visibility: 'public' }, orderBy: [{ sort: 'asc' }, { priceHalalas: 'asc' }] });
  }

  listAll() {
    return this.prisma.package.findMany({ orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }] });
  }

  create(dto: UpsertPackageDto) {
    return this.withSingleDefault(dto.isDefault, (tx) => tx.package.create({ data: dto }));
  }

  update(id: string, dto: Partial<UpsertPackageDto>) {
    return this.withSingleDefault(dto.isDefault, (tx) => tx.package.update({ where: { id }, data: dto }), id);
  }

  /**
   * FRE-009 — "default" is a single-holder flag: every new account is enrolled
   * into exactly one package, so two defaults would make signup's choice
   * arbitrary. Setting it on one package clears it everywhere else in the same
   * transaction rather than relying on the admin to unset the old one.
   */
  private withSingleDefault<T>(
    becomingDefault: boolean | undefined,
    op: (tx: PrismaService) => Promise<T>,
    exceptId?: string,
  ): Promise<T> {
    if (!becomingDefault) return op(this.prisma);
    return this.prisma.$transaction(async (tx) => {
      await tx.package.updateMany({
        where: { isDefault: true, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
        data: { isDefault: false },
      });
      return op(tx as unknown as PrismaService);
    });
  }

  /** The package a brand-new account is enrolled into, if one is nominated. */
  findDefault() {
    return this.prisma.package.findFirst({ where: { isDefault: true, isActive: true } });
  }
}
