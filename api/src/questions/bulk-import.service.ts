import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeStem, stemHash } from './normalize';
import { QuestionsService } from './questions.service';

export interface ImportRow {
  rowIndex: number;
  labelId: string;
  type: string;
  difficulty: number;
  timeLimitS: number | null;
  stem: string;
  options: { key: string; text: string }[];
  correctKey: string;
  explanation: string;
  source: string | null;
  errors: string[];
}

interface ImportDestination {
  labelId: string;
  labelNameAr: string;
  areaNameAr: string;
  sectionNameAr: string;
  testNameAr: string;
}

interface ImportJob {
  id: string;
  createdAt: number;
  rows: ImportRow[];
  destination: ImportDestination;
}

const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e'];
const JOB_TTL_MS = 2 * 60 * 60 * 1000;

// In-memory job store — fine for a single-instance dev deployment; move to
// Redis (already in docker-compose) before running >1 API instance.
@Injectable()
export class BulkImportService {
  private jobs = new Map<string, ImportJob>();

  constructor(
    private prisma: PrismaService,
    private questions: QuestionsService,
  ) {}

  private gc() {
    const now = Date.now();
    for (const [id, job] of this.jobs) {
      if (now - job.createdAt > JOB_TTL_MS) this.jobs.delete(id);
    }
  }

  // ADM-030/031 — destination-first: the label is chosen once in the wizard
  // before upload, never read from a per-row column, so the template stays
  // narrow and mistyped/mismatched taxonomy names can't happen.
  private parseRow(raw: Record<string, string>, rowIndex: number, labelId: string): ImportRow {
    const options: { key: string; text: string }[] = [];
    for (let i = 0; i < 5; i++) {
      const text = (raw[`option_${i + 1}`] ?? '').trim();
      if (text) options.push({ key: OPTION_KEYS[i], text });
    }
    const correctIdx = parseInt(raw['correct_option'] ?? '', 10);
    const correctKey = correctIdx >= 1 && correctIdx <= options.length ? OPTION_KEYS[correctIdx - 1] : '';
    return {
      rowIndex,
      labelId,
      type: (raw['type'] ?? 'mcq_single').trim() || 'mcq_single',
      difficulty: parseInt(raw['difficulty'] ?? '3', 10) || 3,
      timeLimitS: raw['time_limit_s'] ? parseInt(raw['time_limit_s'], 10) : null,
      stem: (raw['stem'] ?? '').trim(),
      options,
      correctKey,
      explanation: (raw['explanation'] ?? '').trim(),
      source: (raw['source'] ?? '').trim() || null,
      errors: [],
    };
  }

  private async validateRows(rows: ImportRow[]): Promise<void> {
    const seenHashes = new Map<string, number>(); // hash -> first rowIndex, to catch in-file duplicates
    const dbHashes = new Set(
      (await this.prisma.question.findMany({ where: {}, select: { stemHash: true } })).map((q) => q.stemHash),
    );

    for (const row of rows) {
      row.errors = [];
      if (row.difficulty < 1 || row.difficulty > 5) row.errors.push('difficulty must be 1..5');
      if (!row.stem) row.errors.push('missing stem');
      if (row.options.length < 2) row.errors.push('needs at least 2 options');
      if (!row.correctKey) row.errors.push('correct_option does not point at a provided option');
      if (!row.explanation) row.errors.push('explanation is mandatory');

      if (row.stem) {
        const hash = stemHash(row.stem);
        if (dbHashes.has(hash)) row.errors.push('duplicate of an existing question (stem hash match)');
        const firstSeenAt = seenHashes.get(hash);
        if (firstSeenAt !== undefined && firstSeenAt !== row.rowIndex) {
          row.errors.push(`duplicate stem hash within this file (also row ${firstSeenAt})`);
        } else {
          seenHashes.set(hash, row.rowIndex);
        }
      }
    }
  }

  async createJob(csvBuffer: Buffer, labelId: string) {
    this.gc();
    const label = await this.prisma.label.findUnique({
      where: { id: labelId },
      include: { area: { include: { section: { include: { test: true } } } } },
    });
    if (!label) throw new BadRequestException('destination label not found');
    if (label.isRetired) throw new BadRequestException('destination label is retired');

    let records: Record<string, string>[];
    try {
      records = parse(csvBuffer, { columns: true, skip_empty_lines: true, trim: true });
    } catch (e: any) {
      throw new BadRequestException(`could not parse CSV: ${e.message}`);
    }
    const rows = records.map((r, i) => this.parseRow(r, i, labelId));
    await this.validateRows(rows);

    const job: ImportJob = {
      id: randomUUID(),
      createdAt: Date.now(),
      rows,
      destination: {
        labelId: label.id,
        labelNameAr: label.nameAr,
        areaNameAr: label.area.nameAr,
        sectionNameAr: label.area.section.nameAr,
        testNameAr: label.area.section.test.nameAr,
      },
    };
    this.jobs.set(job.id, job);
    return this.report(job);
  }

  private report(job: ImportJob) {
    const errorCount = job.rows.filter((r) => r.errors.length > 0).length;
    return {
      jobId: job.id,
      destination: job.destination,
      totalRows: job.rows.length,
      validRows: job.rows.length - errorCount,
      errorRows: errorCount,
      rows: job.rows,
    };
  }

  private getJob(jobId: string): ImportJob {
    const job = this.jobs.get(jobId);
    if (!job) throw new NotFoundException('import job not found or expired');
    return job;
  }

  async patchRow(jobId: string, rowIndex: number, patch: Partial<ImportRow>) {
    const job = this.getJob(jobId);
    const row = job.rows.find((r) => r.rowIndex === rowIndex);
    if (!row) throw new NotFoundException('row not found');
    Object.assign(row, patch);
    await this.validateRows(job.rows); // re-check the whole set: an edit can resolve/introduce cross-row duplicates
    return this.report(job);
  }

  async commit(jobId: string, createdBy?: string) {
    const job = this.getJob(jobId);
    await this.validateRows(job.rows);
    const errorCount = job.rows.filter((r) => r.errors.length > 0).length;
    if (errorCount > 0) {
      // Never partial-commit a bad import — spec §4.2 #3.
      throw new BadRequestException({ message: `${errorCount} row(s) still have errors`, report: this.report(job) });
    }
    let created = 0;
    for (const row of job.rows) {
      await this.questions.create(
        {
          labelId: row.labelId,
          type: row.type as any,
          difficulty: row.difficulty,
          timeLimitS: row.timeLimitS ?? undefined,
          stem: row.stem,
          options: row.options,
          correctKey: row.correctKey,
          explanation: row.explanation,
          source: row.source ?? undefined,
        },
        createdBy,
      );
      created++;
    }
    this.jobs.delete(jobId);
    return { created };
  }
}
