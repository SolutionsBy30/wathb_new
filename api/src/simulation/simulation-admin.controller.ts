import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { BlueprintService } from './blueprint.service';
import { FormService } from './form.service';
import { BlueprintDto, GenerateFormDto, SaveSectionsDto, SetStatusDto } from './dto/simulation.dto';
import { RequirePermission, RequireSession, SessionGuard } from '../auth/session.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionPayload } from '../auth/auth.types';

/**
 * SIM-006 — §9 admin tooling for المحاكي.
 *
 * SessionGuard is not a global APP_GUARD in this app: the class-level
 * @UseGuards below is what protects every route here, and removing it would
 * expose the whole module rather than fail loudly.
 *
 * Route order matters — a literal segment must be declared before the ':id'
 * that would otherwise swallow it — and so does decorator adjacency: a
 * decorator binds to the NEXT method declaration, so never insert a route
 * between a decorator block and the method it was written for.
 */
@UseGuards(SessionGuard)
@RequireSession('admin')
@RequirePermission('simulations')
@Controller('admin/simulation')
export class SimulationAdminController {
  constructor(
    private blueprints: BlueprintService,
    private forms: FormService,
  ) {}

  @Get('blueprints')
  listBlueprints(@Query('testId') testId?: string) {
    return this.blueprints.list(testId);
  }

  @Post('blueprints')
  createBlueprint(@Body() dto: BlueprintDto, @CurrentSession() session: SessionPayload) {
    return this.blueprints.create(dto, session.sub);
  }

  @Get('blueprints/:id')
  getBlueprint(@Param('id') id: string) {
    return this.blueprints.get(id);
  }

  // §9 — the arithmetic check on its own, so the editor can show it live
  // rather than only on save.
  @Get('blueprints/:id/validate')
  validateBlueprint(@Param('id') id: string) {
    return this.blueprints.validate(id);
  }

  // §9 bank readiness: per-area shortfalls before a blueprint is published.
  @Get('blueprints/:id/readiness')
  readiness(@Param('id') id: string, @Query('avoidReuse') avoidReuse?: string) {
    return this.forms.readiness(id, avoidReuse !== 'false');
  }

  @Get('blueprints/:id/forms')
  listForms(@Param('id') id: string) {
    return this.forms.list(id);
  }

  @Post('blueprints/:id')
  updateBlueprint(@Param('id') id: string, @Body() dto: BlueprintDto, @CurrentSession() session: SessionPayload) {
    return this.blueprints.update(id, dto, session.sub);
  }

  @Post('blueprints/:id/sections')
  saveSections(@Param('id') id: string, @Body() dto: SaveSectionsDto, @CurrentSession() session: SessionPayload) {
    return this.blueprints.saveSections(id, dto, session.sub);
  }

  @Post('blueprints/:id/clone')
  cloneBlueprint(@Param('id') id: string, @CurrentSession() session: SessionPayload) {
    return this.blueprints.clone(id, session.sub);
  }

  @Post('blueprints/:id/status')
  setBlueprintStatus(@Param('id') id: string, @Body() dto: SetStatusDto, @CurrentSession() session: SessionPayload) {
    return this.blueprints.setStatus(id, dto.status, session.sub);
  }

  @Post('blueprints/:id/forms')
  generateForm(@Param('id') id: string, @Body() dto: GenerateFormDto, @CurrentSession() session: SessionPayload) {
    return this.forms.generate(id, dto, session.sub);
  }

  @Delete('blueprints/:id')
  deleteBlueprint(@Param('id') id: string, @CurrentSession() session: SessionPayload) {
    return this.blueprints.remove(id, session.sub);
  }

  @Get('forms/:formId')
  getForm(@Param('formId') formId: string) {
    return this.forms.get(formId);
  }

  @Post('forms/:formId/status')
  setFormStatus(@Param('formId') formId: string, @Body() dto: SetStatusDto, @CurrentSession() session: SessionPayload) {
    return this.forms.setStatus(formId, dto.status, session.sub);
  }

  @Delete('forms/:formId')
  deleteForm(@Param('formId') formId: string, @CurrentSession() session: SessionPayload) {
    return this.forms.remove(formId, session.sub);
  }

  // Own path rather than nested under 'forms/:formId' so it can never be
  // confused with a form id.
  @Post('form-items/:itemId/regenerate')
  regenerateItem(@Param('itemId') itemId: string, @CurrentSession() session: SessionPayload) {
    return this.forms.regenerateItem(itemId, session.sub);
  }
}
