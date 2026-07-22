import { Module } from '@nestjs/common';
import { StudentsService } from './students.service';
import { SupervisorsService } from './supervisors.service';
import { PeopleController } from './people.controller';
import { AuthModule } from '../auth/auth.module';
import { AccountsModule } from './accounts.module';

@Module({
  imports: [AuthModule, AccountsModule],
  providers: [StudentsService, SupervisorsService],
  controllers: [PeopleController],
})
export class PeopleModule {}
