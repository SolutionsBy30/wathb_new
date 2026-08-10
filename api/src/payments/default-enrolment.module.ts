import { Module } from '@nestjs/common';
import { DefaultEnrolmentService } from './default-enrolment.service';

// Deliberately dependency-free (PrismaService is global) so both
// AccountsModule and PaymentsModule can import it without a cycle.
@Module({
  providers: [DefaultEnrolmentService],
  exports: [DefaultEnrolmentService],
})
export class DefaultEnrolmentModule {}
