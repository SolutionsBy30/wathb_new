import { Module } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { QuestionsController } from './questions.controller';
import { BulkImportService } from './bulk-import.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [QuestionsService, BulkImportService],
  controllers: [QuestionsController],
  exports: [QuestionsService],
})
export class QuestionsModule {}
