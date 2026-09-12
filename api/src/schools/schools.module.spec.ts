import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SchoolsModule } from './schools.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { SchoolReportService } from './school-report.service';
import { SchoolAuthService } from './school-auth.service';
import { SchoolAdminService } from './school-admin.service';

/**
 * SCH — the module's dependency graph, compiled for real.
 *
 * SchoolAuthService injects OtpService, which AuthModule provided but did not
 * export. That typechecks perfectly and fails at boot — the same class of bug
 * that hit SimulationModule, caught here instead of on the server.
 */
describe('SchoolsModule', () => {
  it('resolves every provider in the module', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, SchoolsModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    for (const type of [SchoolReportService, SchoolAuthService, SchoolAdminService]) {
      expect(moduleRef.get(type)).toBeInstanceOf(type);
    }
    await moduleRef.close();
  });
});
