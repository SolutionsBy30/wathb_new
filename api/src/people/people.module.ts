import { Module } from '@nestjs/common';
import { StudentsService } from './students.service';
import { SupervisorsService } from './supervisors.service';
import { PeopleController } from './people.controller';
import { AuthModule } from '../auth/auth.module';
import { AccountsModule } from './accounts.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [AuthModule, AccountsModule, ReportsModule],
  providers: [StudentsService, SupervisorsService],
  controllers: [PeopleController],
})
export class PeopleModule {}
