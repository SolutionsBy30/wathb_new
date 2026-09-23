import { Module } from '@nestjs/common';
import { SiteContentService } from './site-content.service';
import { SiteContentController } from './site-content.controller';
import { AuthModule } from '../auth/auth.module';
import { AuditLogModule } from '../admin-ops/audit-log.module';

// CMS-001 — the public site's editable copy.
@Module({
  imports: [AuthModule, AuditLogModule],
  providers: [SiteContentService],
  controllers: [SiteContentController],
})
export class ContentModule {}
