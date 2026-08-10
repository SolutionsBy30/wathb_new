import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { DefaultEnrolmentModule } from '../payments/default-enrolment.module';

@Module({
  imports: [DefaultEnrolmentModule],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
