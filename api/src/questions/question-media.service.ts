import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

/**
 * ADM-032 — question artwork. Some items are unanswerable as text: a
 * geometry figure, a chart to read off, a shape sequence. The bank has
 * always carried `stemImageUrl` and a per-option `imageUrl`, but nothing
 * could put a file behind them, so authors had to host images elsewhere.
 *
 * Files are content-addressed (sha256 of the bytes). Re-uploading the same
 * figure returns the same URL instead of accumulating copies, and a URL can
 * never point at different artwork later — which matters because question
 * *versions* are immutable, and a mutable image would silently rewrite the
 * history of what a student was actually shown.
 */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

// SVG is deliberately absent: it is an active document (script, external
// fetches) served from our own origin, not a picture.
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/** Magic-number check — the browser-supplied mimetype is a claim, not proof. */
function sniff(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.toString('ascii', 0, 3) === 'GIF') return 'gif';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

@Injectable()
export class QuestionMediaService {
  constructor(private config: ConfigService) {}

  /** Absolute path of the upload root. Created on demand. */
  get root(): string {
    return resolve(this.config.get<string>('UPLOADS_DIR') ?? join(process.cwd(), 'uploads'));
  }

  /**
   * Served under the API's own prefix rather than a bare /uploads so the
   * existing Nginx `location /api` proxy already covers it — a new media
   * path that needs a webserver change would be broken on deploy day.
   */
  static readonly URL_PREFIX = '/api/uploads';

  store(file: { buffer: Buffer; mimetype: string; size: number } | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('no file uploaded');
    if (file.buffer.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException(`image must be ${MAX_IMAGE_BYTES / 1024 / 1024}MB or smaller`);
    }
    const claimed = ALLOWED_IMAGE_TYPES[file.mimetype];
    const actual = sniff(file.buffer);
    if (!claimed || !actual || claimed !== actual) {
      throw new BadRequestException('image must be a PNG, JPEG, WebP or GIF file');
    }

    const hash = createHash('sha256').update(file.buffer).digest('hex').slice(0, 32);
    const name = `${hash}.${actual}`;
    const dir = join(this.root, 'questions');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, name), file.buffer);
    return { url: `${QuestionMediaService.URL_PREFIX}/questions/${name}`, bytes: file.buffer.length };
  }
}
