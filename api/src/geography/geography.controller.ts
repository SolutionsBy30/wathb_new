import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { GeographyService } from './geography.service';
import { RequireSession, SessionGuard } from '../auth/session.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionPayload } from '../auth/auth.types';
import {
  CreateCityDto,
  CreateRegionDto,
  CreateSchoolDto,
  SuggestSchoolDto,
  UpdateRegionDto,
  UpdateCityDto,
  AddCityAliasDto,
  UpdateSchoolDto,
  MergeSchoolsDto,
} from './dto/geography.dto';

@Controller()
export class GeographyController {
  constructor(private geography: GeographyService) {}

  // Public reference data — regions/cities/schools are needed for signup and
  // profile school-pickers, not just the admin console.
  @Get('geography/regions')
  regions() {
    return this.geography.listRegions();
  }

  @Get('geography/cities')
  cities(@Query('regionId') regionId?: string) {
    return this.geography.listCities(regionId);
  }

  @Get('geography/schools')
  schools(@Query('cityId') cityId?: string, @Query('search') search?: string) {
    return this.geography.listSchools(cityId, search);
  }

  // ADM-063 — resolves a variant spelling (Dammam / الدمام / Ad-Dammam) to
  // its canonical city, via an exact name match or a registered alias.
  @Get('geography/cities/resolve')
  resolveCity(@Query('name') name: string) {
    return this.geography.resolveCity(name);
  }

  @UseGuards(SessionGuard)
  @RequireSession('student')
  @Post('geography/schools/suggest')
  suggest(@Body() dto: SuggestSchoolDto, @CurrentSession() session: SessionPayload) {
    return this.geography.suggestSchool(dto.cityId, dto.nameAr, session.sub);
  }

  // ADM-063 — the management screen needs to see deactivated rows too, not
  // just the active ones the public pickers show.
  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Get('admin/geography/regions')
  adminListRegions() {
    return this.geography.listRegions(true);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Get('admin/geography/cities')
  adminListCities(@Query('regionId') regionId?: string) {
    return this.geography.listCities(regionId, true);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Post('admin/geography/regions')
  createRegion(@Body() dto: CreateRegionDto) {
    return this.geography.createRegion(dto.nameAr, dto.nameEn);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Post('admin/geography/regions/:id')
  updateRegion(@Param('id') id: string, @Body() dto: UpdateRegionDto) {
    return this.geography.updateRegion(id, dto);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Post('admin/geography/regions/:id/active')
  setRegionActive(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.geography.setRegionActive(id, isActive);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Post('admin/geography/cities')
  createCity(@Body() dto: CreateCityDto) {
    return this.geography.createCity(dto.regionId, dto.nameAr, dto.nameEn);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Post('admin/geography/cities/:id')
  updateCity(@Param('id') id: string, @Body() dto: UpdateCityDto) {
    return this.geography.updateCity(id, dto);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Post('admin/geography/cities/:id/active')
  setCityActive(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.geography.setCityActive(id, isActive);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Post('admin/geography/cities/:id/aliases')
  addCityAlias(@Param('id') id: string, @Body() dto: AddCityAliasDto) {
    return this.geography.addCityAlias(id, dto.alias);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Delete('admin/geography/cities/aliases/:aliasId')
  removeCityAlias(@Param('aliasId') aliasId: string) {
    return this.geography.removeCityAlias(aliasId);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Post('admin/geography/schools')
  createSchool(@Body() dto: CreateSchoolDto) {
    return this.geography.createSchool(dto.cityId, dto.nameAr, dto.nameEn);
  }

  // ADM-064 — merge duplicate schools, repointing enrollments rather than
  // orphaning them. Must be registered before 'schools/:id' below, or
  // NestJS would match this path as updateSchool with id='merge'.
  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Post('admin/geography/schools/merge')
  mergeSchools(@Body() dto: MergeSchoolsDto) {
    return this.geography.mergeSchools(dto.sourceId, dto.targetId);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Post('admin/geography/schools/:id')
  updateSchool(@Param('id') id: string, @Body() dto: UpdateSchoolDto) {
    return this.geography.updateSchool(id, dto);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Get('admin/geography/schools/pending')
  pendingSchools() {
    return this.geography.listPendingSchools();
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Post('admin/geography/schools/:id/approve')
  approveSchool(@Param('id') id: string) {
    return this.geography.approveSchool(id);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Delete('admin/geography/schools/:id')
  rejectSchool(@Param('id') id: string) {
    return this.geography.rejectSchool(id);
  }
}
