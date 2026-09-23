import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ContentModule } from './content.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { SiteContentService } from './site-content.service';

/**
 * CMS-001 — the module's dependency graph, compiled for real.
 *
 * SiteContentService injects AuditLogService. That typechecks whether or not
 * AuditLogModule is imported and exported correctly; the failure is at boot,
 * on the server. Two modules in this codebase have already shipped that way.
 */
describe('ContentModule', () => {
  it('resolves every provider in the module', async () => {
    const ref = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, ContentModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    expect(ref.get(SiteContentService)).toBeInstanceOf(SiteContentService);
    await ref.close();
  });
});
