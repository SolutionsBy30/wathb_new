import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProviderSettingsService } from './provider-settings.service';
import { readReachability, Reachability } from './compliance.util';

/**
 * COM-006 — "is this number actually on WhatsApp?", asked once rather than
 * discovered over three days of failed sends.
 *
 * Fail-open by construction. The vendor's endpoint could not be verified from
 * the environment this was written in, so:
 *
 *  - the path is configurable and the check is OFF until one is set;
 *  - an unrecognised response is `unknown`, never `unreachable`;
 *  - a negative result flags the number and warns an admin, it does not block
 *    signup or stop the sends.
 *
 * Getting this backwards — refusing to message real students because a vendor
 * renamed a JSON key — would be far worse than the problem it solves, and the
 * COM-001 suppression ladder already catches dead numbers within days. This is
 * an early warning, not a gate.
 */
@Injectable()
export class ReachabilityService {
  private readonly logger = new Logger(ReachabilityService.name);

  constructor(
    private prisma: PrismaService,
    private providers: ProviderSettingsService,
  ) {}

  private get checkPath(): string | null {
    const path = process.env.WASENDER_NUMBER_CHECK_PATH?.trim();
    return path ? path : null;
  }

  /** Whether the check is configured at all. Surfaced so the console can say so. */
  get enabled(): boolean {
    return this.checkPath !== null;
  }

  /**
   * Ask the vendor, and record the answer. Never throws — the caller is a
   * signup or a profile edit, and neither should fail because a third party
   * is slow.
   */
  async check(userId: string, mobileE164: string): Promise<Reachability> {
    const path = this.checkPath;
    if (!path) return 'unknown';

    let verdict: Reachability = 'unknown';
    try {
      // ProviderSettingsService.list() seeds the primary row from .env on
      // first read, so going through it means the check works whether the
      // credentials live in the database or still in the environment.
      const rows = await this.providers.list();
      const primary = rows.find((r) => r.role === 'primary' && r.provider === 'wasender' && r.isActive);
      if (!primary?.apiKey || !primary?.baseUrl) return 'unknown';

      const digits = mobileE164.replace(/\D/g, '');
      const url = `${primary.baseUrl.replace(/\/$/, '')}${path}${path.includes('?') ? '&' : '?'}phone=${encodeURIComponent(digits)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${primary.apiKey}` } });
      // A non-200 says nothing about the number — only that the probe did not
      // work. Treated as unknown, same as an unrecognised body.
      if (!res.ok) return 'unknown';
      verdict = readReachability(await res.json().catch(() => null));
    } catch (e: any) {
      this.logger.warn(`number check failed for user ${userId}: ${e?.message ?? e}`);
      return 'unknown';
    }

    if (verdict === 'unknown') return verdict;

    await this.prisma.user.update({
      where: { id: userId },
      data: { whatsappReachable: verdict === 'reachable', whatsappCheckedAt: new Date() },
    });
    if (verdict === 'unreachable') {
      this.logger.warn(`user ${userId} reports as not on WhatsApp`);
    }
    return verdict;
  }

  /** COM-006 — numbers the vendor said are not on WhatsApp, for the console. */
  unreachableNumbers() {
    return this.prisma.user.findMany({
      where: { whatsappReachable: false },
      select: { id: true, name: true, mobileE164: true, whatsappCheckedAt: true },
      orderBy: { whatsappCheckedAt: 'desc' },
      take: 200,
    });
  }
}
