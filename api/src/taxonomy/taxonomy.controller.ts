import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TaxonomyService } from './taxonomy.service';
import { RequirePermission, RequireSession, SessionGuard } from '../auth/session.guard';
import { UpsertAreaDto, UpsertLabelDto, UpsertSectionDto, UpsertTestDto } from './dto/taxonomy.dto';

@Controller()
export class TaxonomyController {
  constructor(private taxonomy: TaxonomyService) {}

  // Public — every dropdown, goal-setup screen, etc. reads from this. No test/section/
  // area/label is ever a code enum (spec §3, "Critical requirement").
  @Get('tests')
  listTests() {
    return this.taxonomy.listTests();
  }

  @Get('tests/:id/tree')
  tree(@Param('id') id: string) {
    return this.taxonomy.tree(id);
  }

  /**
   * ADM-088a — reference data, readable by any admin, NOT gated on 'taxonomy'.
   *
   * Every content screen filters by test: the question bank, bulk import, the
   * review queue, question performance. Gating this read on the permission to
   * *edit* the taxonomy meant an admin granted only "بنك الأسئلة" got a 403
   * here, and the app swallowed it into an empty list — so the test filter
   * silently had no options and the bank looked broken.
   *
   * Test names are the console's vocabulary, not a secret. Editing the
   * taxonomy stays gated on 'taxonomy' (every write route below).
   */
  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Get('admin/tests')
  listAllTests() {
    return this.taxonomy.listAllTests();
  }

  // SessionGuard is not registered as an APP_GUARD (only ThrottlerGuard is),
  // so an admin route without these decorators is genuinely public. This one
  // was missing them — anyone could create a test.
  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @RequirePermission('taxonomy')
  @Post('admin/tests')
  createTest(@Body() dto: UpsertTestDto) {
    return this.taxonomy.createTest(dto);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @RequirePermission('taxonomy')
  @Patch('admin/tests/:id')
  updateTest(@Param('id') id: string, @Body() dto: Partial<UpsertTestDto>) {
    return this.taxonomy.updateTest(id, dto);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @RequirePermission('taxonomy')
  @Post('admin/tests/:testId/sections')
  createSection(@Param('testId') testId: string, @Body() dto: UpsertSectionDto) {
    return this.taxonomy.createSection(testId, dto);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @RequirePermission('taxonomy')
  @Patch('admin/sections/:id')
  updateSection(@Param('id') id: string, @Body() dto: Partial<UpsertSectionDto>) {
    return this.taxonomy.updateSection(id, dto);
  }

  // ADM-014 — only ever succeeds for an empty branch; see the service for why
  // a populated one is refused rather than cascaded.
  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @RequirePermission('taxonomy')
  @Delete('admin/sections/:id')
  deleteSection(@Param('id') id: string) {
    return this.taxonomy.deleteSection(id);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @RequirePermission('taxonomy')
  @Delete('admin/areas/:id')
  deleteArea(@Param('id') id: string) {
    return this.taxonomy.deleteArea(id);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @RequirePermission('taxonomy')
  @Post('admin/sections/:sectionId/areas')
  createArea(@Param('sectionId') sectionId: string, @Body() dto: UpsertAreaDto) {
    return this.taxonomy.createArea(sectionId, dto);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @RequirePermission('taxonomy')
  @Patch('admin/areas/:id')
  updateArea(@Param('id') id: string, @Body() dto: Partial<UpsertAreaDto>) {
    return this.taxonomy.updateArea(id, dto);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @RequirePermission('taxonomy')
  @Post('admin/areas/:areaId/labels')
  createLabel(@Param('areaId') areaId: string, @Body() dto: UpsertLabelDto) {
    return this.taxonomy.createLabel(areaId, dto);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @RequirePermission('taxonomy')
  @Patch('admin/labels/:id')
  updateLabel(@Param('id') id: string, @Body() dto: Partial<UpsertLabelDto>) {
    return this.taxonomy.updateLabel(id, dto);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @RequirePermission('taxonomy')
  @Post('admin/labels/:id/retire')
  retireLabel(@Param('id') id: string) {
    return this.taxonomy.retireLabel(id);
  }
}
