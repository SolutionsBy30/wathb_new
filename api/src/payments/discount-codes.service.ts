import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { applyPromoCode, PROMO_REJECTION_AR } from './pricing.util';

/**
 * PAY-011 — promo codes.
 *
 * Codes are stored and compared uppercase: students type these off a poster
 * or a forwarded WhatsApp message, and "wathb20" failing while "WATHB20"
 * works is a support ticket, not a security boundary.
 */
export function normaliseCode(raw: string): string {
  return raw.trim().toUpperCase();
}

@Injectable()
export class DiscountCodesService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.discountCode.findMany({ orderBy: { createdAt: 'desc' } });
  }

  private parseDates(dto: { startsAt?: string | null; expiresAt?: string | null }) {
    return {
      ...(dto.startsAt !== undefined ? { startsAt: dto.startsAt ? new Date(dto.startsAt) : null } : {}),
      ...(dto.expiresAt !== undefined ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null } : {}),
    };
  }

  private assertValue(kind: 'percent' | 'fixed' | undefined, value: number | undefined) {
    if (kind === 'percent' && value !== undefined && (value < 1 || value > 100)) {
      throw new BadRequestException('percent discount must be between 1 and 100');
    }
    if (kind === 'fixed' && value !== undefined && value < 1) {
      throw new BadRequestException('fixed discount must be at least 1 halala');
    }
  }

  async create(dto: {
    code: string; kind: 'percent' | 'fixed'; value: number;
    packageIds?: string[]; maxRedemptions?: number | null;
    startsAt?: string | null; expiresAt?: string | null; isActive?: boolean;
  }) {
    const code = normaliseCode(dto.code);
    if (!code) throw new BadRequestException('code is required');
    this.assertValue(dto.kind, dto.value);
    const clash = await this.prisma.discountCode.findUnique({ where: { code } });
    if (clash) throw new BadRequestException('a code with this name already exists');
    return this.prisma.discountCode.create({
      data: {
        code,
        kind: dto.kind,
        value: dto.value,
        packageIds: dto.packageIds ?? [],
        maxRedemptions: dto.maxRedemptions ?? null,
        isActive: dto.isActive ?? true,
        ...this.parseDates(dto),
      },
    });
  }

  async update(id: string, dto: Partial<{
    code: string; kind: 'percent' | 'fixed'; value: number;
    packageIds: string[]; maxRedemptions: number | null;
    startsAt: string | null; expiresAt: string | null; isActive: boolean;
  }>) {
    const existing = await this.prisma.discountCode.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('discount code not found');
    this.assertValue(dto.kind ?? (existing.kind as 'percent' | 'fixed'), dto.value);
    const code = dto.code !== undefined ? normaliseCode(dto.code) : undefined;
    if (code && code !== existing.code) {
      const clash = await this.prisma.discountCode.findUnique({ where: { code } });
      if (clash) throw new BadRequestException('a code with this name already exists');
    }
    return this.prisma.discountCode.update({
      where: { id },
      data: {
        ...(code ? { code } : {}),
        ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
        ...(dto.value !== undefined ? { value: dto.value } : {}),
        ...(dto.packageIds !== undefined ? { packageIds: dto.packageIds } : {}),
        ...(dto.maxRedemptions !== undefined ? { maxRedemptions: dto.maxRedemptions } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...this.parseDates(dto),
      },
    });
  }

  /**
   * Preview a code against a package before checkout, so the student sees the
   * new total before committing rather than discovering it at the gateway.
   *
   * Returns the rejection reason in Arabic rather than throwing: a wrong code
   * is ordinary user input, not an exceptional condition.
   */
  async preview(rawCode: string, packageId: string) {
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg || !pkg.isActive) throw new NotFoundException('package not found or inactive');

    const code = await this.prisma.discountCode.findUnique({ where: { code: normaliseCode(rawCode) } });
    const result = applyPromoCode(code as any, packageId, pkg.priceHalalas);
    if (!result.ok) return { ok: false as const, reason: result.reason, message: PROMO_REJECTION_AR[result.reason] };
    return {
      ok: true as const,
      code: code!.code,
      discountHalalas: result.discountHalalas,
      totalHalalas: result.totalHalalas,
      originalHalalas: pkg.priceHalalas,
    };
  }
}
