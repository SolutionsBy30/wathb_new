import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogEntry {
  actorId?: string | null;
  actorLabel: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  note?: string;
}

// ADM-085 — a full audit trail of admin actions. Write-mostly: callers
// record() from wherever the action actually happens (subscriptions,
// OTP fallback, suspension) rather than reconstructing history after the
// fact from other tables.
@Injectable()
export class AuditLogService {
  constructor(private prisma: PrismaService) {}

  async record(entry: AuditLogEntry) {
    await this.prisma.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        actorLabel: entry.actorLabel,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: entry.before === undefined ? Prisma.JsonNull : (entry.before as Prisma.InputJsonValue),
        after: entry.after === undefined ? Prisma.JsonNull : (entry.after as Prisma.InputJsonValue),
        note: entry.note,
      },
    });
  }

  list(limit = 200) {
    return this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
  }
}
