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
import { CreateQuestionDto, ListQuestionsQuery, UpdateQuestionContentDto } from './dto/questions.dto';
import { RequireSession, SessionGuard } from '../auth/session.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionPayload } from '../auth/auth.types';

@UseGuards(SessionGuard)
@RequireSession('admin')
@Controller('admin/questions')
export class QuestionsController {
  constructor(
    private questions: QuestionsService,
    private bulkImport: BulkImportService,
    private questionStats: QuestionStatsService,
  ) {}

  // §6 "refresh_question_stats" — admin-triggered stand-in for the nightly job.
  @Post('refresh-stats')
  refreshStats() {
    return this.questionStats.refreshAll();
  }

  @Get()
  list(@Query() query: ListQuestionsQuery) {
    return this.questions.list(query);
  }

  @Get('similar')
  similar(@Query('stem') stem: string) {
    return this.questions.findSimilar(stem);
  }

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

  @Post('bulk-retire')
  bulkRetire(@Body('ids') ids: string[]) {
    return this.questions.bulkRetire(ids);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  importCsv(@UploadedFile() file: Express.Multer.File, @Body('labelId') labelId: string) {
    if (!labelId) throw new BadRequestException('labelId is required — select a destination before uploading (ADM-030)');
    return this.bulkImport.createJob(file.buffer, labelId);
  }

  @Patch('import/:jobId/rows/:rowIndex')
  patchImportRow(
    @Param('jobId') jobId: string,
    @Param('rowIndex', ParseIntPipe) rowIndex: number,
    @Body() patch: Record<string, unknown>,
  ) {
    return this.bulkImport.patchRow(jobId, rowIndex, patch as any);
  }

  @Post('import/:jobId/commit')
  commitImport(@Param('jobId') jobId: string, @CurrentSession() session: SessionPayload) {
    return this.bulkImport.commit(jobId, session.sub);
  }
}
