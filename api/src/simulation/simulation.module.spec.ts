import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SimulationModule } from './simulation.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { BlueprintService } from './blueprint.service';
import { FormService } from './form.service';
import { EligibilityService } from './eligibility.service';
import { AttemptService } from './attempt.service';
import { SimulationReportService } from './simulation-report.service';
import { SimulationNotifyService } from './simulation-notify.service';

/**
 * SIM — the module's dependency graph, compiled for real.
 *
 * TypeScript cannot see this class of bug: SimulationNotifyService injects the
 * NOTIFICATION_CHANNEL token, and importing a module that does not export it
 * typechecks perfectly and then fails at boot. That happened while building
 * this stage, and without a test it would have failed on the server instead of
 * here.
 *
 * compile() resolves every provider without calling onModuleInit, so no
 * database is touched — PrismaService is overridden with a bare object purely
 * so the container has something to inject.
 */
describe('SimulationModule', () => {
  const build = () =>
    // PrismaModule and ConfigModule are @Global, but only once something has
    // imported them — AppModule does that in production, so the test has to
    // stand them up itself.
    Test.createTestingModule({ imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, SimulationModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

  it('resolves every provider in the module', async () => {
    const moduleRef = await build();
    for (const type of [
      BlueprintService,
      FormService,
      EligibilityService,
      AttemptService,
      SimulationReportService,
      SimulationNotifyService,
    ]) {
      expect(moduleRef.get(type)).toBeInstanceOf(type);
    }
    await moduleRef.close();
  });
});
