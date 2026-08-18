import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DAILY_PLACEHOLDERS,
  DailyPlaceholder,
  PLACEHOLDER_LABELS_AR,
  pickRandom,
  renderMessageBody,
  validateMessageBody,
} from './message-template.util';

export const DAILY_WATHB_KIND = 'daily_wathb';

/**
 * NOT-017 — the admin-managed pool of daily-leap message bodies.
 *
 * The pool is advisory, never load-bearing: renderRandom returns null when
 * there is nothing active to send, and the caller keeps its built-in wording.
 * Deleting or deactivating every row degrades to the previous behaviour rather
 * than to an empty message.
 */
@Injectable()
export class NotificationMessagesService {
  constructor(private prisma: PrismaService) {}

  list(kind = DAILY_WATHB_KIND) {
    return this.prisma.notificationMessage.findMany({ where: { kind }, orderBy: { createdAt: 'desc' } });
  }

  /** The placeholder vocabulary, so the admin screen never hardcodes it. */
  placeholders() {
    return DAILY_PLACEHOLDERS.map((key) => ({ key, label: PLACEHOLDER_LABELS_AR[key] }));
  }

  create(body: string, isActive = true, kind = DAILY_WATHB_KIND) {
    this.assertValid(body);
    return this.prisma.notificationMessage.create({ data: { body: body.trim(), isActive, kind } });
  }

  async update(id: string, dto: { body?: string; isActive?: boolean }) {
    if (dto.body !== undefined) this.assertValid(dto.body);
    const existing = await this.prisma.notificationMessage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('message not found');
    return this.prisma.notificationMessage.update({
      where: { id },
      data: {
        ...(dto.body !== undefined ? { body: dto.body.trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.notificationMessage.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('message not found');
    await this.prisma.notificationMessage.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Render one active variant at random, or null when the pool is empty.
   *
   * Rendering happens here rather than in the caller so the pick and the
   * substitution cannot drift apart — a body is only ever chosen together with
   * the values that fill it.
   */
  async renderRandom(vars: Partial<Record<DailyPlaceholder, string>>, kind = DAILY_WATHB_KIND): Promise<string | null> {
    const active = await this.prisma.notificationMessage.findMany({
      where: { kind, isActive: true },
      select: { body: true },
    });
    const chosen = pickRandom(active);
    if (!chosen) return null;
    const rendered = renderMessageBody(chosen.body, vars);
    // A body that renders to nothing (every placeholder empty, no literal
    // text) must not be sent as a blank WhatsApp message; fall back instead.
    return rendered.length > 0 ? rendered : null;
  }

  /** Admin-screen preview — the same renderer the sender uses, with sample values. */
  preview(body: string) {
    const error = validateMessageBody(body);
    if (error) return { ok: false as const, message: error };
    return {
      ok: true as const,
      text: renderMessageBody(body, {
        student_name: 'سارة',
        magic_link: 'https://wathb.tech/#magic=…',
        test_name: 'قدرات',
      }),
    };
  }

  private assertValid(body: string) {
    const error = validateMessageBody(body);
    if (error) throw new BadRequestException(error);
  }
}
