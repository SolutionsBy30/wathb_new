import { Module } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { QuestionsController } from './questions.controller';
import { BulkImportService } from './bulk-import.service';
import { QuestionStatsService } from './question-stats.service';
import { ProblemReportsService } from './problem-reports.service';
import { QuestionMediaService } from './question-media.service';
import { AuthModule } from '../auth/auth.module';
import { AuditLogModule } from '../admin-ops/audit-log.module';

@Module({
  imports: [AuthModule, AuditLogModule],
  providers: [QuestionsService, BulkImportService, QuestionStatsService, ProblemReportsService, QuestionMediaService],
  controllers: [QuestionsController],
  exports: [QuestionsService, QuestionStatsService],
})
export class QuestionsModule {}
