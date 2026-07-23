import { Module } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { QuestionsController } from './questions.controller';
import { BulkImportService } from './bulk-import.service';
import { QuestionStatsService } from './question-stats.service';
import { AuthModule } from '../auth/auth.module';
import { AuditLogModule } from '../admin-ops/audit-log.module';

@Module({
  imports: [AuthModule, AuditLogModule],
  providers: [QuestionsService, BulkImportService, QuestionStatsService],
  controllers: [QuestionsController],
  exports: [QuestionsService],
})
export class QuestionsModule {}
