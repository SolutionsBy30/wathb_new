import { Module } from '@nestjs/common';
import { BlueprintService } from './blueprint.service';
import { FormService } from './form.service';
import { EligibilityService } from './eligibility.service';
import { AttemptService } from './attempt.service';
import { SimulationAdminController } from './simulation-admin.controller';
import { SimulationStudentController } from './simulation-student.controller';
import { SimulationReportService } from './simulation-report.service';
import { SimulationReportController } from './simulation-report.controller';
import { SimulationNotifyService } from './simulation-notify.service';
import { SimulationAnalyticsService } from './simulation-analytics.service';
import { AuthModule } from '../auth/auth.module';
import { AuditLogModule } from '../admin-ops/audit-log.module';
import { NotificationChannelModule } from '../notifications/notification-channel.module';

// SIM — المحاكي. AttemptService materialises dynamic forms through
// FormService rather than re-implementing assembly, so the exam a student
// actually sits comes off the same engine an admin previews.
@Module({
  // NotificationChannelModule rather than NotificationsModule: the channel
  // token is what SimulationNotifyService needs, and it was split out for
  // exactly this — depending on the whole notifications module would drag in
  // WathbModule and ReportsModule for nothing.
  imports: [AuthModule, AuditLogModule, NotificationChannelModule],
  providers: [BlueprintService, FormService, EligibilityService, AttemptService, SimulationReportService, SimulationNotifyService, SimulationAnalyticsService],
  controllers: [SimulationAdminController, SimulationStudentController, SimulationReportController],
  exports: [BlueprintService, FormService, EligibilityService, AttemptService, SimulationReportService],
})
export class SimulationModule {}
