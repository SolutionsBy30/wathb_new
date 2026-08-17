import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertPackageDto } from './dto/packages.dto';
import { packagePriceView } from './pricing.util';

@Injectable()
export class PackagesService {
  constructor(private prisma: PrismaService) {}

  /**
   * PAY-010 — every list decorates each package with its price view, so the
   * rule for what counts as a genuine saving lives in one tested place
   * (pricing.util) instead of being re-implemented in the student app, the
   * landing page and the supervisor app. compareAtHalalas comes back null
   * unless it is strictly greater than the price.
   */
  private withPriceView<T extends { priceHalalas: number; compareAtHalalas: number | null }>(pkg: T) {
    return { ...pkg, ...packagePriceView(pkg) };
  }

  async listPublic() {
    const rows = await this.prisma.package.findMany({ where: { isActive: true, visibility: 'public' }, orderBy: [{ sort: 'asc' }, { priceHalalas: 'asc' }] });
    return rows.map((p) => this.withPriceView(p));
  }

  async listAll() {
    const rows = await this.prisma.package.findMany({ orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }] });
    return rows.map((p) => this.withPriceView(p));
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
