import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { PeopleModule } from '../people/people.module';
import { ReportsModule } from '../reports/reports.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StudentsService } from '../people/students.service';
import { SupervisorsService } from '../people/supervisors.service';
import { ReportsService } from '../reports/reports.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WeeklyReportService } from '../notifications/weekly-report.service';
import { EntitlementsService } from './entitlements.service';

/**
 * PAY-013 — the modules that now depend on EntitlementsService, compiled for
 * real.
 *
 * Five services across three modules gained a constructor dependency in one
 * change. Every one of those typechecks whether or not the providing module is
 * imported and exported correctly; the failure is at boot, on the server. That
 * has already happened twice in this codebase (SimulationModule's
 * NOTIFICATION_CHANNEL, SchoolsModule's OtpService), so the wiring is asserted
 * here instead.
 */
describe('EntitlementsService wiring', () => {
  const compile = (mod: unknown) =>
    Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, mod as never],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

  it('resolves inside PeopleModule', async () => {
    const ref = await compile(PeopleModule);
    expect(ref.get(StudentsService)).toBeInstanceOf(StudentsService);
    expect(ref.get(SupervisorsService)).toBeInstanceOf(SupervisorsService);
    expect(ref.get(EntitlementsService)).toBeInstanceOf(EntitlementsService);
    await ref.close();
  });

  it('resolves inside ReportsModule', async () => {
    const ref = await compile(ReportsModule);
    expect(ref.get(ReportsService)).toBeInstanceOf(ReportsService);
    await ref.close();
  });

  it('resolves inside NotificationsModule', async () => {
    const ref = await compile(NotificationsModule);
    expect(ref.get(NotificationsService)).toBeInstanceOf(NotificationsService);
    expect(ref.get(WeeklyReportService)).toBeInstanceOf(WeeklyReportService);
    await ref.close();
  });
});
