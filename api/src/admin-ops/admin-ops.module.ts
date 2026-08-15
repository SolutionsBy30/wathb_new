import { Module } from '@nestjs/common';
import { AdminOpsController } from './admin-ops.controller';
import { SuspensionService } from './suspension.service';
import { AdminUsersService } from './admin-users.service';
import { AdminUsersController } from './admin-users.controller';
import { AuditLogModule } from './audit-log.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, AuditLogModule],
  providers: [SuspensionService, AdminUsersService],
  controllers: [AdminOpsController, AdminUsersController],
})
export class AdminOpsModule {}
