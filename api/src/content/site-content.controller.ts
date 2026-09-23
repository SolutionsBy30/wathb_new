import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SiteContentService } from './site-content.service';
import { RequirePermission, RequireSession, SessionGuard } from '../auth/session.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionPayload } from '../auth/auth.types';
import { SetSiteTextDto, UpsertLandingFeatureDto } from './dto/content.dto';

@Controller()
export class SiteContentController {
  constructor(private content: SiteContentService) {}

  /**
   * CMS-001 — public and unauthenticated, like /packages and /tests. It is the
   * text on a marketing page; gating it would only stop the page rendering for
   * the visitors it exists for.
   */
  @Get('site-content')
  publicContent() {
    return this.content.publicContent();
  }

  // Everything below edits the public face of the product.
  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @RequirePermission('landing')
  @Get('admin/site-content')
  adminContent() {
    return this.content.adminContent();
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @RequirePermission('landing')
  @Patch('admin/site-content/:key')
  setText(@Param('key') key: string, @Body() dto: SetSiteTextDto, @CurrentSession() session: SessionPayload) {
    return this.content.setText(key, dto.valueAr, session.sub);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @RequirePermission('landing')
  @Post('admin/landing-features')
  createFeature(@Body() dto: UpsertLandingFeatureDto, @CurrentSession() session: SessionPayload) {
    return this.content.createFeature(dto, session.sub);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @RequirePermission('landing')
  @Patch('admin/landing-features/:id')
  updateFeature(@Param('id') id: string, @Body() dto: Partial<UpsertLandingFeatureDto>, @CurrentSession() session: SessionPayload) {
    return this.content.updateFeature(id, dto, session.sub);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @RequirePermission('landing')
  @Delete('admin/landing-features/:id')
  deleteFeature(@Param('id') id: string, @CurrentSession() session: SessionPayload) {
    return this.content.deleteFeature(id, session.sub);
  }
}
