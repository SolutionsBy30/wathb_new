import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../admin-ops/audit-log.service';
import { CreateQuestionDto, ListQuestionsQuery, UpdateQuestionContentDto } from './dto/questions.dto';
import { normalizeStem, stemHash } from './normalize';

@Injectable()
export class QuestionsService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  async list(query: ListQuestionsQuery) {
    const where: Prisma.QuestionWhereInput = {
      labelId: query.labelId,
      difficulty: query.difficulty,
      status: query.status as any,
      label: query.areaId || query.sectionId || query.testId ? {
        areaId: query.areaId,
        area: query.sectionId || query.testId ? {
          sectionId: query.sectionId,
          section: query.testId ? { testId: query.testId } : undefined,
        } : undefined,
      } : undefined,
    };
    if (query.search) {
      where.OR = [
        { versions: { some: { stem: { contains: query.search, mode: 'insensitive' } } } },
      ];
    }

    const include = {
      label: { include: { area: { include: { section: { include: { test: true } } } } } },
      versions: { orderBy: { version: 'desc' as const }, take: 1, include: { stats: true } },
    };
    const skip = query.offset ?? 0;
    const take = query.limit ?? 50;
    const dir = query.sortDir === 'asc' ? 'asc' : 'desc';

    // ADM-096 — columns that live on Question itself sort through Prisma.
    const PLAIN_SORTS: Record<string, Prisma.QuestionOrderByWithRelationInput> = {
      createdAt: { createdAt: dir },
      difficulty: { difficulty: dir },
      status: { status: dir },
      label: { label: { nameAr: dir } },
    };

    if (!query.sortBy || PLAIN_SORTS[query.sortBy]) {
      const [total, items] = await this.prisma.$transaction([
        this.prisma.question.count({ where }),
        this.prisma.question.findMany({
          where,
          skip,
          take,
          orderBy: PLAIN_SORTS[query.sortBy ?? 'createdAt'] ?? { createdAt: 'desc' },
          include,
        }),
      ]);
      return { total, items };
    }

    return this.listSortedByStats(where, query.sortBy, dir, skip, take, include);
  }

  /**
   * ADM-096 — sort by a column that lives on QuestionStats (or the version's
   * stem), which Prisma cannot order by: the stats hang off the latest of a
   * to-many `versions` relation, and orderBy has no path through that.
   *
   * Sorting client-side over the current page was the tempting shortcut and
   * would have been quietly wrong — the point of "sort by lowest p-value" is
   * to find the worst questions in the whole test, not the worst 50 that
   * happened to be on screen.
   *
   * The filter stays in Prisma and only the ORDER BY is raw: the id set is
   * resolved with the same `where` every other path uses, then ordered in
   * SQL. Two queries instead of one, but no second implementation of the
   * filter semantics to drift out of step.
   *
   * NULLS LAST throughout: a question with no stats yet is "unknown", and
   * unknown sorting above a genuinely bad p-value would bury the thing the
   * admin opened this screen to find.
   */
  private async listSortedByStats(
    where: Prisma.QuestionWhereInput,
    sortBy: string,
    dir: 'asc' | 'desc',
    skip: number,
    take: number,
    include: any,
  ) {
    // Whitelist — these strings are interpolated into SQL, so nothing may
    // reach Prisma.$queryRawUnsafe that did not come from this map.
    const COLUMNS: Record<string, string> = {
      stem: 'qv.stem',
      nServed: 'qs."nServed"',
      pValue: 'qs."pValue"',
      discrimination: 'qs.discrimination',
      meanTimeMs: 'qs."meanTimeMs"',
      timeoutRate: 'qs."timeoutRate"',
      explanationScore: 'COALESCE(qs."explanationUpvotes", 0) - COALESCE(qs."explanationDownvotes", 0)',
    };
    const column = COLUMNS[sortBy];
    if (!column) throw new BadRequestException(`cannot sort by ${sortBy}`);

    const matching = await this.prisma.question.findMany({ where, select: { id: true } });
    const total = matching.length;
    if (total === 0) return { total: 0, items: [] };
    const ids = matching.map((q) => q.id);

    // Tagged $queryRaw, not $queryRawUnsafe: only the whitelisted ORDER BY
    // fragment is Prisma.raw, while every value stays a bound parameter.
    // The id set goes in as ONE array parameter rather than an IN list —
    // Prisma.join would emit a placeholder per id and a large bank would run
    // into Postgres's parameter ceiling.
    const ordered = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT q.id
        FROM questions q
        LEFT JOIN LATERAL (
          SELECT v.id, v.stem FROM question_versions v
           WHERE v."questionId" = q.id
           ORDER BY v.version DESC
           LIMIT 1
        ) qv ON TRUE
        LEFT JOIN question_stats qs ON qs."questionVersionId" = qv.id
       WHERE q.id = ANY(${ids}::text[])
       ORDER BY ${Prisma.raw(column)} ${Prisma.raw(dir.toUpperCase())} NULLS LAST, q."createdAt" DESC
       LIMIT ${take} OFFSET ${skip}`;

    const pageIds = ordered.map((r) => r.id);
    const items = await this.prisma.question.findMany({ where: { id: { in: pageIds } }, include });
    // findMany does not preserve the id order, so re-apply it.
    const byId = new Map(items.map((q) => [q.id, q]));
    return { total, items: pageIds.map((id) => byId.get(id)).filter(Boolean) };
  }

  async get(id: string) {
    const question = await this.prisma.question.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: 'desc' } }, label: true },
    });
    if (!question) throw new NotFoundException('question not found');
    return question;
  }

  /** Exact-hash + fuzzy (pg_trgm) duplicate check — spec §4.2 #4. */
  async findSimilar(stem: string, threshold = 0.45) {
    const hash = stemHash(stem);
    const exact = await this.prisma.question.findFirst({ where: { stemHash: hash } });
    const normalized = normalizeStem(stem);
    const fuzzy = await this.prisma.$queryRaw<{ questionId: string; stem: string; sim: number }[]>`
      SELECT qv."questionId" as "questionId", qv.stem, similarity(qv.stem, ${normalized}) as sim
      FROM question_versions qv
      WHERE similarity(qv.stem, ${normalized}) > ${threshold}
      ORDER BY sim DESC
      LIMIT 5
    `.catch(() => [] as { questionId: string; stem: string; sim: number }[]); // pg_trgm may not be ready on first boot
    return { exactDuplicateQuestionId: exact?.id ?? null, fuzzyMatches: fuzzy };
  }

  async create(dto: CreateQuestionDto, createdBy?: string) {
    if (!dto.options.some((o) => o.key === dto.correctKey)) {
      throw new BadRequestException('correctKey must match one of the options');
    }
    const hash = stemHash(dto.stem);
    const question = await this.prisma.$transaction(async (tx) => {
      const q = await tx.question.create({
        data: {
          labelId: dto.labelId,
          passageId: dto.passageId,
          type: dto.type ?? 'mcq_single',
          difficulty: dto.difficulty,
          timeLimitS: dto.timeLimitS,
          status: 'draft',
          source: dto.source,
          stemHash: hash,
          createdBy,
        },
      });
      const version = await tx.questionVersion.create({
        data: {
          questionId: q.id,
          version: 1,
          stem: dto.stem,
          stemImageUrl: dto.stemImageUrl,
          options: dto.options as unknown as Prisma.InputJsonValue,
          correctKey: dto.correctKey,
          explanation: dto.explanation,
          createdBy,
        },
      });
      return tx.question.update({ where: { id: q.id }, data: { currentVersionId: version.id }, include: { versions: true } });
    });
    return question;
  }

  /**
   * Editing a published question creates a new version; historic answers stay
   * bound to the version they were served, so analytics never silently change
   * meaning underneath an admin's typo fix (spec §3.1).
   */
  async createNewVersion(questionId: string, dto: UpdateQuestionContentDto, createdBy?: string) {
    const question = await this.get(questionId);
    if (!dto.options.some((o) => o.key === dto.correctKey)) {
      throw new BadRequestException('correctKey must match one of the options');
    }
    const nextVersion = (question.versions[0]?.version ?? 0) + 1;
    const version = await this.prisma.questionVersion.create({
      data: {
        questionId,
        version: nextVersion,
        stem: dto.stem,
        stemImageUrl: dto.stemImageUrl,
        options: dto.options as unknown as Prisma.InputJsonValue,
        correctKey: dto.correctKey,
        explanation: dto.explanation,
        createdBy,
      },
    });
    return this.prisma.question.update({
      where: { id: questionId },
      data: { currentVersionId: version.id, stemHash: stemHash(dto.stem), difficulty: dto.difficulty, timeLimitS: dto.timeLimitS },
    });
  }

  setStatus(id: string, status: 'draft' | 'in_review' | 'published' | 'retired') {
    return this.prisma.question.update({ where: { id }, data: { status } });
  }

  bulkSetStatus(ids: string[], status: 'draft' | 'in_review' | 'published' | 'retired') {
    return this.prisma.question.updateMany({ where: { id: { in: ids } }, data: { status } });
  }

  async bulkRetire(ids: string[]) {
    return this.prisma.question.updateMany({ where: { id: { in: ids } }, data: { status: 'retired' } });
  }

  /** ADM-027 — in_review questions awaiting a second reviewer, oldest first (FIFO). */
  reviewQueue() {
    return this.prisma.question.findMany({
      where: { status: 'in_review' },
      orderBy: { createdAt: 'asc' },
      include: {
        label: { include: { area: { include: { section: { include: { test: true } } } } } },
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
    });
  }

  /** A second reviewer approves — publishes the question as-is. */
  async approveReview(id: string, reviewerId: string, comment?: string) {
    const question = await this.get(id);
    if (question.status !== 'in_review') throw new BadRequestException('question is not awaiting review');
    const updated = await this.prisma.question.update({ where: { id }, data: { status: 'published' } });
    await this.auditLog.record({
      actorId: reviewerId,
      actorLabel: 'admin',
      action: 'question.review_approved',
      entityType: 'Question',
      entityId: id,
      note: comment,
    });
    return updated;
  }

  /**
   * A second reviewer rejects — sends the question back to draft so its
   * author can revise and resubmit, rather than a dead-end status. The
   * comment is required here since it's the only place the author will see
   * *why* (spec §3.4 "approve/reject with a comment").
   */
  async rejectReview(id: string, reviewerId: string, comment: string) {
    if (!comment?.trim()) throw new BadRequestException('a comment is required when rejecting');
    const question = await this.get(id);
    if (question.status !== 'in_review') throw new BadRequestException('question is not awaiting review');
    const updated = await this.prisma.question.update({ where: { id }, data: { status: 'draft' } });
    await this.auditLog.record({
      actorId: reviewerId,
      actorLabel: 'admin',
      action: 'question.review_rejected',
      entityType: 'Question',
      entityId: id,
      note: comment,
    });
    return updated;
  }
}
