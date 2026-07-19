import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WathbGenerationService } from './wathb-generation.service';

const DEFAULT_BUNDLE_SIZE = 5;
const TIMEOUT_GRACE_MS = 3000;

function ladderStep(current: number, questionDifficulty: number, isCorrect: boolean): number {
  if (isCorrect && questionDifficulty >= current) return Math.min(5, current + 1);
  if (!isCorrect && questionDifficulty <= current) return Math.max(1, current - 1);
  return current;
}

function publicQuestion(wq: { position: number; questionId: string; servedAt: Date | null; questionVersion: any; question: any }) {
  const options = (wq.questionVersion.options as { key: string; text: string; imageUrl?: string }[]).map((o) => ({
    key: o.key,
    text: o.text,
    imageUrl: o.imageUrl,
  }));
  return {
    position: wq.position,
    questionId: wq.questionId,
    questionVersionId: wq.questionVersion.id,
    stem: wq.questionVersion.stem,
    stemImageUrl: wq.questionVersion.stemImageUrl,
    options,
    servedAt: wq.servedAt,
    // Client timer is UI only — server remains authoritative on served_at -> answered_at (spec §9.5).
    timeLimitS: wq.question.timeLimitS ?? wq.question.label.defaultTimeLimitS,
  };
}

const WATHB_QUESTIONS_INCLUDE = {
  orderBy: { position: 'asc' as const },
  include: { questionVersion: true, question: { include: { label: true } } },
};

@Injectable()
export class WathbService {
  constructor(
    private prisma: PrismaService,
    private generation: WathbGenerationService,
  ) {}

  async today(studentId: string) {
    const student = await this.prisma.student.findUnique({ where: { userId: studentId } });
    if (!student) throw new NotFoundException('student not found');
    if (!student.targetTestId) throw new BadRequestException('goal setup not complete: no target test selected');

    const todayDate = new Date();
    todayDate.setUTCHours(0, 0, 0, 0);

    let wathb = await this.prisma.wathb.findUnique({
      where: { studentId_scheduledFor: { studentId, scheduledFor: todayDate } },
      include: { questions: WATHB_QUESTIONS_INCLUDE },
    });

    if (!wathb) {
      wathb = !student.placementDoneAt
        ? await this.generation.generatePlacement(studentId, student.targetTestId, student.track ?? null)
        : await this.generation.generateDaily(studentId, student.targetTestId, student.track ?? null, DEFAULT_BUNDLE_SIZE);
      if (!wathb) {
        throw new BadRequestException('no eligible questions available today — bank exhausted, contact support');
      }
    }

    if (wathb.status === 'pending') {
      const first = wathb.questions.find((q) => q.position === 0);
      await this.prisma.$transaction([
        this.prisma.wathb.update({ where: { id: wathb.id }, data: { status: 'opened' } }),
        ...(first && !first.servedAt
          ? [this.prisma.wathbQuestion.update({ where: { id: first.id }, data: { servedAt: new Date() } })]
          : []),
      ]);
      wathb = await this.prisma.wathb.findUniqueOrThrow({ where: { id: wathb.id }, include: { questions: WATHB_QUESTIONS_INCLUDE } });
    }

    const answered = await this.prisma.answer.findMany({ where: { wathbId: wathb.id }, select: { questionId: true } });
    const answeredIds = new Set(answered.map((a) => a.questionId));
    const currentPosition = wathb.questions.find((q) => !answeredIds.has(q.questionId))?.position ?? null;

    return {
      wathbId: wathb.id,
      bundleType: wathb.bundleType,
      status: wathb.status,
      currentPosition,
      totalQuestions: wathb.questions.length,
      answeredCount: answeredIds.size,
      questions: wathb.questions.map(publicQuestion),
    };
  }

  async answer(studentId: string, wathbId: string, position: number, selectedKey: string | null) {
    const wathb = await this.prisma.wathb.findUnique({
      where: { id: wathbId },
      include: { questions: WATHB_QUESTIONS_INCLUDE },
    });
    if (!wathb) throw new NotFoundException('wathb not found');
    if (wathb.studentId !== studentId) throw new ForbiddenException();
    if (wathb.status === 'completed') throw new BadRequestException('wathb already completed');

    const already = await this.prisma.answer.findMany({ where: { wathbId }, select: { questionId: true } });
    const answeredIds = new Set(already.map((a) => a.questionId));
    const nextExpected = wathb.questions.find((q) => !answeredIds.has(q.questionId));
    if (!nextExpected || nextExpected.position !== position) {
      // No back button, no skip — spec §6.3.
      throw new BadRequestException('answers must be submitted in order, one at a time');
    }

    const servedAt = nextExpected.servedAt ?? new Date();
    const now = new Date();
    const elapsedMs = now.getTime() - servedAt.getTime();
    const timeLimitMs = (await this.effectiveTimeLimitS(nextExpected.questionId)) * 1000;
    const timedOut = selectedKey == null || elapsedMs > timeLimitMs + TIMEOUT_GRACE_MS;
    const isCorrect = !timedOut && selectedKey === nextExpected.questionVersion.correctKey;

    await this.prisma.$transaction(async (tx) => {
      if (!nextExpected.servedAt) {
        await tx.wathbQuestion.update({ where: { id: nextExpected.id }, data: { servedAt } });
      }
      await tx.answer.create({
        data: {
          wathbId,
          studentId,
          questionId: nextExpected.questionId,
          questionVersionId: nextExpected.questionVersionId,
          labelId: (await tx.question.findUniqueOrThrow({ where: { id: nextExpected.questionId }, select: { labelId: true } })).labelId,
          selectedKey: selectedKey ?? undefined,
          isCorrect,
          timeTakenMs: Math.max(0, elapsedMs),
          timedOut,
          answeredAt: now,
        },
      });

      const question = await tx.question.findUniqueOrThrow({ where: { id: nextExpected.questionId } });
      const existingStat = await tx.studentLabelStat.findUnique({
        where: { studentId_labelId: { studentId, labelId: question.labelId } },
      });
      if (!existingStat) {
        await tx.studentLabelStat.create({
          data: {
            studentId,
            labelId: question.labelId,
            nAnswered: 1,
            nCorrect: isCorrect ? 1 : 0,
            meanTimeMs: Math.max(0, elapsedMs),
            difficultyLevel: ladderStep(3, question.difficulty, isCorrect),
            lastServedAt: now,
          },
        });
      } else {
        const nAnswered = existingStat.nAnswered + 1;
        const meanTimeMs = Math.round(
          (existingStat.meanTimeMs * existingStat.nAnswered + Math.max(0, elapsedMs)) / nAnswered,
        );
        await tx.studentLabelStat.update({
          where: { studentId_labelId: { studentId, labelId: question.labelId } },
          data: {
            nAnswered,
            nCorrect: existingStat.nCorrect + (isCorrect ? 1 : 0),
            meanTimeMs,
            difficultyLevel: ladderStep(existingStat.difficultyLevel, question.difficulty, isCorrect),
            lastServedAt: now,
          },
        });
      }

      const next = wathb.questions.find((q) => q.position === position + 1);
      if (next && !next.servedAt) {
        await tx.wathbQuestion.update({ where: { id: next.id }, data: { servedAt: now } });
      }
    });

    const isLast = position === wathb.questions.length - 1;
    return { recorded: true, nextPosition: isLast ? null : position + 1 };
  }

  private async effectiveTimeLimitS(questionId: string): Promise<number> {
    const q = await this.prisma.question.findUniqueOrThrow({
      where: { id: questionId },
      include: { label: true },
    });
    return q.timeLimitS ?? q.label.defaultTimeLimitS;
  }

  async complete(studentId: string, wathbId: string) {
    const wathb = await this.prisma.wathb.findUnique({
      where: { id: wathbId },
      include: { questions: WATHB_QUESTIONS_INCLUDE },
    });
    if (!wathb) throw new NotFoundException('wathb not found');
    if (wathb.studentId !== studentId) throw new ForbiddenException();

    // Interruption handling (§6.3): anything still unanswered at complete-time closes as timed out.
    const already = await this.prisma.answer.findMany({ where: { wathbId } });
    const answeredIds = new Set(already.map((a) => a.questionId));
    for (const wq of wathb.questions) {
      if (!answeredIds.has(wq.questionId)) {
        await this.answer(studentId, wathbId, wq.position, null);
      }
    }

    const student = await this.prisma.student.findUniqueOrThrow({ where: { userId: studentId } });
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const wasYesterday =
      student.lastCompletedOn &&
      today.getTime() - new Date(student.lastCompletedOn).setUTCHours(0, 0, 0, 0) === 86400000;
    const newStreak = wasYesterday || !student.lastCompletedOn ? student.currentStreak + 1 : 1;

    await this.prisma.$transaction([
      this.prisma.wathb.update({ where: { id: wathbId }, data: { status: 'completed', completedAt: new Date() } }),
      this.prisma.student.update({
        where: { userId: studentId },
        data: {
          currentStreak: newStreak,
          lastCompletedOn: today,
          placementDoneAt: wathb.bundleType === 'placement' ? new Date() : undefined,
        },
      }),
    ]);

    const finalAnswers = await this.prisma.answer.findMany({
      where: { wathbId },
      include: { questionVersion: true },
      orderBy: { answeredAt: 'asc' },
    });
    const byQuestion = new Map(finalAnswers.map((a) => [a.questionId, a]));

    const questions = wathb.questions.map((wq) => {
      const a = byQuestion.get(wq.questionId)!;
      return {
        position: wq.position,
        stem: wq.questionVersion.stem,
        options: wq.questionVersion.options,
        correctKey: wq.questionVersion.correctKey,
        explanation: wq.questionVersion.explanation,
        selectedKey: a.selectedKey,
        isCorrect: a.isCorrect,
        timedOut: a.timedOut,
      };
    });

    return {
      wathbId,
      streak: newStreak,
      total: questions.length,
      correctCount: questions.filter((q) => q.isCorrect).length,
      questions,
    };
  }
}
