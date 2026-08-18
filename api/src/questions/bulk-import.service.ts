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
  stemImageUrl: string | null;
  options: { key: string; text: string; imageUrl?: string }[];
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
    // ADM-032 — artwork columns are optional. CSV can only carry a URL, so
    // a bulk import points at images that are already hosted (either
    // uploaded through the editor, or on the author's own server); the
    // single-question editor is where files themselves get uploaded.
    const options: { key: string; text: string; imageUrl?: string }[] = [];
    for (let i = 0; i < 5; i++) {
      const text = (raw[`option_${i + 1}`] ?? '').trim();
      const imageUrl = (raw[`option_${i + 1}_image`] ?? '').trim();
      if (text || imageUrl) options.push({ key: OPTION_KEYS[i], text, imageUrl: imageUrl || undefined });
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
      stemImageUrl: (raw['stem_image_url'] ?? '').trim() || null,
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

  /**
   * ADM-094 — commit the job.
   *
   * Default stays all-or-nothing (spec §4.2 #3): a file whose errors are
   * typos should be fixed and re-imported whole, not half-landed leaving the
   * author to work out which half.
   *
   * skipInvalid opts into importing the good rows and dropping the rest. The
   * case that made this necessary is a file of mostly-new questions where a
   * handful are duplicates of ones already in the bank — nothing to "fix",
   * since the correct outcome for those rows is precisely to not import them,
   * and requiring the author to delete them by hand first is busywork on a
   * file of hundreds.
   *
   * It is an explicit flag rather than the default so a partial import is
   * always something someone chose, and the skipped rows come back in the
   * response so the screen can say exactly what was left behind rather than
   * reporting a smaller number than the author expected with no explanation.
   */
  async commit(jobId: string, createdBy?: string, skipInvalid = false) {
    const job = this.getJob(jobId);
    // Re-validated here, not trusted from upload time: another import may
    // have landed the same stem in between, so a row valid a minute ago can
    // be a duplicate now.
    await this.validateRows(job.rows);
    const invalid = job.rows.filter((r) => r.errors.length > 0);

    if (invalid.length > 0 && !skipInvalid) {
      throw new BadRequestException({ message: `${invalid.length} row(s) still have errors`, report: this.report(job) });
    }

    const toImport = job.rows.filter((r) => r.errors.length === 0);
    if (toImport.length === 0) {
      // Nothing to do, and silently reporting "0 created" would look like the
      // import worked.
      throw new BadRequestException({ message: 'no valid rows to import', report: this.report(job) });
    }

    let created = 0;
    for (const row of toImport) {
      await this.questions.create(
        {
          labelId: row.labelId,
          type: row.type as any,
          difficulty: row.difficulty,
          timeLimitS: row.timeLimitS ?? undefined,
          stem: row.stem,
          stemImageUrl: row.stemImageUrl ?? undefined,
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
    return {
      created,
      skipped: invalid.length,
      // +1 so the row number matches the spreadsheet the author is looking at
      // (header is row 1, so data row 0 is row 2).
      skippedRows: invalid.map((r) => ({ row: r.rowIndex + 2, stem: r.stem.slice(0, 80), errors: r.errors })),
    };
  }
}
