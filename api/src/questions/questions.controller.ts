import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { QuestionsService } from './questions.service';
import { BulkImportService } from './bulk-import.service';
import { QuestionStatsService } from './question-stats.service';
import { ProblemReportsService } from './problem-reports.service';
import { MAX_IMAGE_BYTES, QuestionMediaService } from './question-media.service';
import { CreateQuestionDto, ListQuestionsQuery, UpdateQuestionContentDto } from './dto/questions.dto';
import { RequirePermission, RequireSession, SessionGuard } from '../auth/session.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionPayload } from '../auth/auth.types';

@UseGuards(SessionGuard)
@RequireSession('admin')
@RequirePermission('bank')
@Controller('admin/questions')
export class QuestionsController {
  constructor(
    private questions: QuestionsService,
    private bulkImport: BulkImportService,
    private questionStats: QuestionStatsService,
    private problemReports: ProblemReportsService,
    private media: QuestionMediaService,
  ) {}

  // ADM-032 — upload artwork for a stem or an option (graphs, geometry
  // figures, shape sequences). Returns the URL to store on the version;
  // the caller decides whether it belongs to the stem or an option.
  // Declared before ':id' so 'images' isn't parsed as a question id.
  @Post('images')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_IMAGE_BYTES } }))
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    return this.media.store(file);
  }

  // STU-012 — the admin inbox for "report a problem." Must come before
  // ':id' or 'problem-reports' would be parsed as a question id.
  @RequirePermission('problemReports')
  @Get('problem-reports')
  listProblemReports(@Query('status') status?: 'open' | 'resolved') {
    return this.problemReports.list(status);
  }

  @RequirePermission('problemReports')
  @Post('problem-reports/:id/resolve')
  resolveProblemReport(@Param('id') id: string, @CurrentSession() session: SessionPayload) {
    return this.problemReports.resolve(id, session.sub);
  }

  // §6 "refresh_question_stats" — admin-triggered stand-in for the nightly job.
  @RequirePermission('solutionPerf')
  @Post('refresh-stats')
  refreshStats() {
    return this.questionStats.refreshAll();
  }

  /**
   * ADM-088a — question performance and the review queue both list questions.
   * Class-level 'bank' alone meant an admin granted only "أداء الأسئلة" got a
   * 403 on the screen's first call and saw nothing.
   */
  @RequirePermission('bank', 'reviewQueue', 'problemReports', 'import', 'solutionPerf')
  @Get()
  list(@Query() query: ListQuestionsQuery) {
    return this.questions.list(query);
  }

  @RequirePermission('bank', 'reviewQueue', 'problemReports', 'import', 'solutionPerf')
  @Get('similar')
  similar(@Query('stem') stem: string) {
    return this.questions.findSimilar(stem);
  }

  // ADM-027 — must come before ':id' or 'review-queue' would be parsed as an id.
  @RequirePermission('reviewQueue')
  @Get('review-queue')
  reviewQueue() {
    return this.questions.reviewQueue();
  }

  @RequirePermission('bank', 'reviewQueue', 'problemReports', 'import', 'solutionPerf')
  @Get(':id')
  get(@Param('id') id: string) {
    return this.questions.get(id);
  }

  @Post()
  create(@Body() dto: CreateQuestionDto, @CurrentSession() session: SessionPayload) {
    return this.questions.create(dto, session.sub);
  }

  @Post(':id/versions')
  newVersion(@Param('id') id: string, @Body() dto: UpdateQuestionContentDto, @CurrentSession() session: SessionPayload) {
    return this.questions.createNewVersion(id, dto, session.sub);
  }

  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body('status') status: 'draft' | 'in_review' | 'published' | 'retired') {
    return this.questions.setStatus(id, status);
  }

  @RequirePermission('reviewQueue')
  @Post(':id/approve')
  approve(@Param('id') id: string, @Body('comment') comment: string | undefined, @CurrentSession() session: SessionPayload) {
    return this.questions.approveReview(id, session.sub, comment);
  }

  @RequirePermission('reviewQueue')
  @Post(':id/reject')
  reject(@Param('id') id: string, @Body('comment') comment: string, @CurrentSession() session: SessionPayload) {
    return this.questions.rejectReview(id, session.sub, comment);
  }

  @Post('bulk-retire')
  bulkRetire(@Body('ids') ids: string[]) {
    return this.questions.bulkRetire(ids);
  }

  @Post('bulk-status')
  bulkStatus(@Body('ids') ids: string[], @Body('status') status: 'draft' | 'in_review' | 'published' | 'retired') {
    return this.questions.bulkSetStatus(ids, status);
  }

  @RequirePermission('import')
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  importCsv(@UploadedFile() file: Express.Multer.File, @Body('labelId') labelId: string) {
    if (!labelId) throw new BadRequestException('labelId is required — select a destination before uploading (ADM-030)');
    return this.bulkImport.createJob(file.buffer, labelId);
  }

  @RequirePermission('import')
  @Patch('import/:jobId/rows/:rowIndex')
  patchImportRow(
    @Param('jobId') jobId: string,
    @Param('rowIndex', ParseIntPipe) rowIndex: number,
    @Body() patch: Record<string, unknown>,
  ) {
    return this.bulkImport.patchRow(jobId, rowIndex, patch as any);
  }

  @RequirePermission('import')
  @Post('import/:jobId/commit')
  commitImport(@Param('jobId') jobId: string, @CurrentSession() session: SessionPayload) {
    return this.bulkImport.commit(jobId, session.sub);
  }
}
