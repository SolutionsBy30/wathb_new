import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertPackageDto } from './dto/packages.dto';
import { packagePriceView } from './pricing.util';
import { groupsForPackage } from './package-groups.util';

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

  /**
   * PAY-015 — the catalogue segments a package belongs to, derived from the
   * tests it covers. Loaded once per list rather than per package.
   */
  private async grouping() {
    const [tests, groups] = await Promise.all([
      this.prisma.test.findMany({ select: { id: true, groupId: true } }),
      this.prisma.testGroup.findMany({ select: { id: true, nameAr: true, sort: true } }),
    ]);
    return (testIds: string[]) => groupsForPackage(testIds, tests, groups);
  }

  async listPublic() {
    const [rows, groupOf] = await Promise.all([
      this.prisma.package.findMany({ where: { isActive: true, visibility: 'public' }, orderBy: [{ sort: 'asc' }, { priceHalalas: 'asc' }] }),
      this.grouping(),
    ]);
    return rows.map((p) => ({ ...this.withPriceView(p), ...groupOf(p.testIds) }));
  }

  /**
   * PAY-014 — the admin list carries how many subscriptions each package has.
   *
   * Editing a package is not a private act: removing a test revokes it for
   * everyone currently subscribed, and a price change reshapes the pricing
   * page. The console needs the number to warn with before the edit, not a
   * support ticket after it.
   *
   * Active and total are both reported: active is who is affected right now,
   * total is whether this package has ever been sold — which is what decides
   * whether it can be reshaped freely or is a historical record.
   */
  async listAll() {
    const [rows, groupOf] = await Promise.all([
      this.prisma.package.findMany({
        orderBy: [{ sort: 'asc' }, { createdAt: 'desc' }],
        include: {
          _count: { select: { subscriptions: true } },
          subscriptions: { where: { status: 'active' }, select: { id: true } },
        },
      }),
      this.grouping(),
    ]);
    return rows.map(({ subscriptions, _count, ...p }) => ({
      ...this.withPriceView(p),
      ...groupOf(p.testIds),
      activeSubscriptions: subscriptions.length,
      totalSubscriptions: _count.subscriptions,
    }));
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
