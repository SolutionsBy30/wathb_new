import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestionDto, ListQuestionsQuery, UpdateQuestionContentDto } from './dto/questions.dto';
import { normalizeStem, stemHash } from './normalize';

@Injectable()
export class QuestionsService {
  constructor(private prisma: PrismaService) {}

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

    const [total, items] = await this.prisma.$transaction([
      this.prisma.question.count({ where }),
      this.prisma.question.findMany({
        where,
        skip: query.offset ?? 0,
        take: query.limit ?? 50,
        orderBy: { createdAt: 'desc' },
        include: {
          label: { include: { area: { include: { section: { include: { test: true } } } } } },
          versions: { orderBy: { version: 'desc' }, take: 1, include: { stats: true } },
        },
      }),
    ]);
    return { total, items };
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

  async bulkRetire(ids: string[]) {
    return this.prisma.question.updateMany({ where: { id: { in: ids } }, data: { status: 'retired' } });
  }
}
