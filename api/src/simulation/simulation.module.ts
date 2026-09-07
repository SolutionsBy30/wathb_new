import { Module } from '@nestjs/common';
import { BlueprintService } from './blueprint.service';
import { FormService } from './form.service';
import { SimulationAdminController } from './simulation-admin.controller';
import { AuthModule } from '../auth/auth.module';
import { AuditLogModule } from '../admin-ops/audit-log.module';

// SIM — المحاكي. Exports the two services because the attempt runtime (next
// stage) reads blueprints and materialises dynamic forms through them rather
// than re-implementing assembly.
@Module({
  imports: [AuthModule, AuditLogModule],
  providers: [BlueprintService, FormService],
  controllers: [SimulationAdminController],
  exports: [BlueprintService, FormService],
})
export class SimulationModule {}
