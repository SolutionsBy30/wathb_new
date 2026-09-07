import { Module } from '@nestjs/common';
import { BlueprintService } from './blueprint.service';
import { FormService } from './form.service';
import { EligibilityService } from './eligibility.service';
import { AttemptService } from './attempt.service';
import { SimulationAdminController } from './simulation-admin.controller';
import { SimulationStudentController } from './simulation-student.controller';
import { AuthModule } from '../auth/auth.module';
import { AuditLogModule } from '../admin-ops/audit-log.module';

// SIM — المحاكي. AttemptService materialises dynamic forms through
// FormService rather than re-implementing assembly, so the exam a student
// actually sits comes off the same engine an admin previews.
@Module({
  imports: [AuthModule, AuditLogModule],
  providers: [BlueprintService, FormService, EligibilityService, AttemptService],
  controllers: [SimulationAdminController, SimulationStudentController],
  exports: [BlueprintService, FormService, EligibilityService, AttemptService],
})
export class SimulationModule {}
