import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../admin-ops/audit-log.service';
import { isKnownKey, SITE_CONTENT_KEYS, withDefaults } from './site-content.util';

/**
 * CMS-001 — the landing page's editable copy and feature cards.
 *
 * Reads are public and unauthenticated: this is the text on a marketing page,
 * and gating it would only mean the page cannot render for the visitors it
 * exists for. Writes are admin-only.
 */
@Injectable()
export class SiteContentService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditLogService,
  ) {}

  /** Everything the public page needs, defaults filled in. */
  async publicContent() {
    const [rows, features] = await Promise.all([
      this.prisma.siteContent.findMany(),
      this.prisma.landingFeature.findMany({
        where: { isActive: true },
        orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, titleAr: true, bodyAr: true },
      }),
    ]);
    return { text: withDefaults(rows), features };
  }

  /**
   * The editor's view: every declared key with its label, its stored value and
   * whether it is still on the default, plus inactive features.
   *
   * Built from SITE_CONTENT_KEYS rather than from the table, so a key added in
   * code appears in the console immediately instead of after someone
   * remembers to seed it.
   */
  async adminContent() {
    const [rows, features] = await Promise.all([
      this.prisma.siteContent.findMany(),
      this.prisma.landingFeature.findMany({ orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }] }),
    ]);
    const stored = new Map(rows.map((r) => [r.key, r]));
    return {
      keys: SITE_CONTENT_KEYS.map((d) => {
        const row = stored.get(d.key);
        const hasValue = !!row?.valueAr?.trim();
        return {
          ...d,
          valueAr: hasValue ? row!.valueAr : d.defaultAr,
          // So the editor can say "this is still the shipped wording" rather
          // than implying someone chose it.
          isDefault: !hasValue,
          updatedAt: row?.updatedAt ?? null,
        };
      }),
      features,
    };
  }

  async setText(key: string, valueAr: string, adminUserId: string) {
    // Refused rather than stored: an unknown key would sit in the table
    // forever, rendered by nothing and findable by nobody.
    if (!isKnownKey(key)) throw new BadRequestException('مفتاح محتوى غير معروف');

    const row = await this.prisma.siteContent.upsert({
      where: { key },
      create: { key, valueAr },
      update: { valueAr },
    });
    await this.record(adminUserId, 'site_content.updated', key, `حُدِّث نص «${key}»`);
    return row;
  }

  createFeature(dto: { titleAr: string; bodyAr: string; sort?: number }, adminUserId: string) {
    return this.prisma.landingFeature
      .create({ data: { titleAr: dto.titleAr, bodyAr: dto.bodyAr, sort: dto.sort ?? 0 } })
      .then(async (f) => {
        await this.record(adminUserId, 'landing_feature.created', f.id, `أضاف ميزة «${f.titleAr}»`);
        return f;
      });
  }

  async updateFeature(id: string, dto: Partial<{ titleAr: string; bodyAr: string; sort: number; isActive: boolean }>, adminUserId: string) {
    const before = await this.prisma.landingFeature.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('الميزة غير موجودة');
    const f = await this.prisma.landingFeature.update({ where: { id }, data: dto });
    await this.record(adminUserId, 'landing_feature.updated', id, `عدّل ميزة «${f.titleAr}»`);
    return f;
  }

  async deleteFeature(id: string, adminUserId: string) {
    const before = await this.prisma.landingFeature.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('الميزة غير موجودة');
    await this.prisma.landingFeature.delete({ where: { id } });
    await this.record(adminUserId, 'landing_feature.deleted', id, `حذف ميزة «${before.titleAr}»`);
    return { deleted: true };
  }

  /**
   * Every change is logged. This is the public face of the product: "who
   * changed the price line on the homepage" is a question that gets asked, and
   * a marketing edit is exactly the kind of change nobody remembers making.
   */
  private async record(adminUserId: string, action: string, entityId: string, note: string) {
    const admin = await this.prisma.user.findUnique({ where: { id: adminUserId }, select: { name: true, email: true } });
    await this.audit.record({
      actorId: adminUserId,
      actorLabel: admin?.email ?? admin?.name ?? adminUserId,
      action,
      entityType: 'SiteContent',
      entityId,
      note,
    });
  }
}
