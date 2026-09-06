import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationChannel } from './channel.interface';
import { ConsoleChannel } from './console-channel';
import { WasenderChannel } from './wasender-channel';
import { WhatsAppCloudChannel } from './whatsapp-cloud-channel';
import { isPlaceholder } from './whatsapp-provider.util';

export type ProviderRole = 'primary' | 'backup';
export type ProviderHealth = 'unknown' | 'connected' | 'disconnected';

/**
 * NOT-023 — the WhatsApp senders and their health.
 *
 * Two things live here that used to live only in .env: which transport sends,
 * and its credentials. Moving them into the database is what makes a backup
 * number possible (two configurations at once) and lets an admin rotate a
 * token after a session drops without an SSH session and a redeploy.
 */
@Injectable()
export class ProviderSettingsService {
  private readonly logger = new Logger(ProviderSettingsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  /**
   * The rows, seeding 'primary' from .env the first time.
   *
   * Seeding rather than requiring setup keeps the migration non-breaking: an
   * existing deployment carries on sending with exactly the configuration it
   * already had, and the console shows that configuration rather than an
   * empty screen implying nothing is set up.
   */
  async list() {
    const rows = await this.prisma.notificationProvider.findMany({ orderBy: { role: 'asc' } });
    if (rows.some((r) => r.role === 'primary')) return rows;

    const seeded = await this.prisma.notificationProvider.create({
      data: {
        role: 'primary',
        provider: this.envProviderKind(),
        label: this.config.get<string>('WHATSAPP_SENDER_LABEL') ?? null,
        apiKey: this.envOrNull('WASENDER_API_KEY'),
        baseUrl: this.envOrNull('WASENDER_BASE_URL'),
        statusPath: this.envOrNull('WASENDER_STATUS_PATH'),
        accessToken: this.envOrNull('WHATSAPP_ACCESS_TOKEN'),
        phoneNumberId: this.envOrNull('WHATSAPP_PHONE_NUMBER_ID'),
      },
    });
    return [seeded, ...rows];
  }

  private envOrNull(key: string): string | null {
    const v = this.config.get<string>(key);
    // isPlaceholder treats "...", "changeme" and friends as unset — the same
    // rule the boot guard uses, so a placeholder never becomes a stored
    // credential that looks real on the settings screen.
    return isPlaceholder(v) ? null : (v as string);
  }

  private envProviderKind(): string {
    const explicit = this.config.get<string>('WHATSAPP_PROVIDER')?.trim().toLowerCase();
    if (explicit === 'wasender' || explicit === 'meta') return explicit;
    return isPlaceholder(this.config.get<string>('WHATSAPP_ACCESS_TOKEN')) ? 'wasender' : 'meta';
  }

  /** Credentials never leave the server; the console gets a shape, not a secret. */
  async listForAdmin() {
    const rows = await this.list();
    return rows.map((r) => ({
      id: r.id,
      role: r.role,
      provider: r.provider,
      label: r.label,
      isActive: r.isActive,
      baseUrl: r.baseUrl,
      statusPath: r.statusPath,
      phoneNumberId: r.phoneNumberId,
      // Enough to tell "a key is set" and "it is not the one I just replaced"
      // apart, without being enough to use.
      apiKeyHint: mask(r.apiKey),
      accessTokenHint: mask(r.accessToken),
      status: r.status as ProviderHealth,
      lastCheckedAt: r.lastCheckedAt,
      lastOkAt: r.lastOkAt,
      lastError: r.lastError,
      configured: this.isConfigured(r),
    }));
  }

  isConfigured(row: {
    provider: string;
    apiKey: string | null;
    accessToken: string | null;
    phoneNumberId: string | null;
  }): boolean {
    if (row.provider === 'wasender') return !isPlaceholder(row.apiKey ?? undefined);
    if (row.provider === 'meta') {
      return !isPlaceholder(row.accessToken ?? undefined) && !isPlaceholder(row.phoneNumberId ?? undefined);
    }
    return true; // console
  }

  async upsert(role: ProviderRole, dto: Record<string, unknown>) {
    // An empty string means "leave it alone", not "clear it": the console
    // sends masked hints back on every save, and treating those as a new value
    // would wipe a working credential the moment someone edits the label.
    const data: Record<string, unknown> = {};
    for (const key of ['provider', 'label', 'baseUrl', 'statusPath', 'phoneNumberId'] as const) {
      if (dto[key] !== undefined) data[key] = dto[key] === '' ? null : dto[key];
    }
    if (typeof dto.isActive === 'boolean') data.isActive = dto.isActive;
    for (const key of ['apiKey', 'accessToken'] as const) {
      const v = dto[key];
      if (typeof v === 'string' && v.trim() !== '') data[key] = v.trim();
    }
    // A changed credential invalidates whatever the last probe concluded.
    if (data.apiKey || data.accessToken || data.provider) {
      data.status = 'unknown';
      data.lastError = null;
    }

    return this.prisma.notificationProvider.upsert({
      where: { role },
      create: { role, provider: 'wasender', ...data },
      update: data,
    });
  }

  async remove(role: ProviderRole) {
    if (role === 'primary') throw new NotFoundException('the primary sender cannot be removed, only deactivated');
    await this.prisma.notificationProvider.deleteMany({ where: { role } });
    return { deleted: true };
  }

  /** Build the adapter for a row, or null when it is not usable. */
  buildChannel(row: {
    provider: string;
    apiKey: string | null;
    baseUrl: string | null;
    accessToken: string | null;
    phoneNumberId: string | null;
  }): NotificationChannel | null {
    if (!this.isConfigured(row)) return null;
    if (row.provider === 'wasender') {
      return new WasenderChannel(overrideConfig(this.config, {
        WASENDER_API_KEY: row.apiKey,
        WASENDER_BASE_URL: row.baseUrl,
      }));
    }
    if (row.provider === 'meta') {
      return new WhatsAppCloudChannel(overrideConfig(this.config, {
        WHATSAPP_ACCESS_TOKEN: row.accessToken,
        WHATSAPP_PHONE_NUMBER_ID: row.phoneNumberId,
      }));
    }
    return new ConsoleChannel();
  }

  /**
   * Probe one sender.
   *
   * Returns 'unknown' — never 'disconnected' — when the probe itself cannot be
   * trusted: a 404 means the status path is wrong for this vendor, not that
   * the session is down, and treating that as down would stop every send over
   * a guessed URL. Only a definite negative answer marks a sender disconnected.
   */
  async check(role: ProviderRole): Promise<{ role: ProviderRole; status: ProviderHealth; detail: string }> {
    const rows = await this.list();
    const row = rows.find((r) => r.role === role);
    if (!row) throw new NotFoundException('sender not found');

    if (!this.isConfigured(row)) {
      await this.record(role, 'disconnected', 'credentials are missing');
      return { role, status: 'disconnected', detail: 'لم تُضبط بيانات الاتصال.' };
    }

    try {
      if (row.provider === 'meta') {
        const res = await fetch(`https://graph.facebook.com/v20.0/${row.phoneNumberId}`, {
          headers: { Authorization: `Bearer ${row.accessToken}` },
        });
        if (res.ok) {
          await this.record(role, 'connected', null);
          return { role, status: 'connected', detail: 'متصل.' };
        }
        // 401/403 is a definite "this token will not send".
        if (res.status === 401 || res.status === 403) {
          await this.record(role, 'disconnected', `Meta rejected the token (${res.status})`);
          return { role, status: 'disconnected', detail: `رفضت Meta الرمز (${res.status}).` };
        }
        await this.record(role, 'unknown', `Meta returned ${res.status}`);
        return { role, status: 'unknown', detail: `رد غير متوقع من Meta (${res.status}).` };
      }

      const base = (row.baseUrl ?? 'https://wasenderapi.com/api').replace(/\/$/, '');
      const path = row.statusPath ?? '/status';
      const res = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${row.apiKey}` } });
      const text = (await res.text()).slice(0, 300);

      if (res.status === 401 || res.status === 403) {
        await this.record(role, 'disconnected', `provider rejected the API key (${res.status})`);
        return { role, status: 'disconnected', detail: `رُفض مفتاح الـ API (${res.status}).` };
      }
      if (!res.ok) {
        // Including 404: the wrong status path is a configuration question,
        // not evidence about the session.
        await this.record(role, 'unknown', `status probe returned ${res.status}`);
        return { role, status: 'unknown', detail: `تعذّر التحقق (${res.status}) — راجع مسار الفحص.` };
      }

      const lower = text.toLowerCase();
      if (lower.includes('disconnect') || (lower.includes('"connected"') && lower.includes('false'))) {
        await this.record(role, 'disconnected', 'session reported as not connected');
        return { role, status: 'disconnected', detail: 'الجلسة غير متصلة — أعد ربط الهاتف.' };
      }
      if (lower.includes('connect')) {
        await this.record(role, 'connected', null);
        return { role, status: 'connected', detail: 'متصل.' };
      }
      await this.record(role, 'unknown', 'status response not understood');
      return { role, status: 'unknown', detail: 'رد غير مفهوم من المزوّد.' };
    } catch (e: any) {
      // A network failure here says nothing definite about the session.
      await this.record(role, 'unknown', e?.message ?? 'probe failed');
      return { role, status: 'unknown', detail: `تعذّر الوصول للمزوّد: ${e?.message ?? ''}` };
    }
  }

  async record(role: string, status: ProviderHealth, error: string | null) {
    await this.prisma.notificationProvider.updateMany({
      where: { role },
      data: {
        status,
        lastError: error,
        lastCheckedAt: new Date(),
        ...(status === 'connected' ? { lastOkAt: new Date() } : {}),
      },
    });
  }

  /**
   * NOT-023 — is there any sender that could plausibly deliver right now?
   *
   * 'unknown' counts as usable. The alternative is refusing to send because a
   * probe could not reach a vendor, which would turn a monitoring gap into an
   * outage — the failure mode this whole change exists to prevent.
   */
  async anyUsable(): Promise<boolean> {
    const rows = await this.list();
    return rows.some((r) => r.isActive && this.isConfigured(r) && r.status !== 'disconnected');
  }

  /** Everything the console's red box needs, in one call. */
  async health() {
    const rows = await this.listForAdmin();
    const usable = rows.filter((r) => r.isActive && r.configured && r.status !== 'disconnected');
    return {
      ok: usable.length > 0,
      usableCount: usable.length,
      providers: rows,
    };
  }
}

function mask(secret: string | null): string | null {
  if (!secret) return null;
  if (secret.length <= 8) return '••••';
  return `${secret.slice(0, 3)}••••${secret.slice(-3)}`;
}

/**
 * A ConfigService view with a few keys overridden, so the existing adapters —
 * which read their credentials from config in their constructors — can be
 * built per row without being rewritten.
 */
function overrideConfig(base: ConfigService, overrides: Record<string, string | null>): ConfigService {
  return {
    get: (key: string, def?: unknown) => (key in overrides ? (overrides[key] ?? def) : base.get(key, def as any)),
    getOrThrow: (key: string) => {
      const v = key in overrides ? overrides[key] : base.get(key);
      if (v == null || v === '') throw new Error(`missing configuration: ${key}`);
      return v;
    },
  } as unknown as ConfigService;
}
