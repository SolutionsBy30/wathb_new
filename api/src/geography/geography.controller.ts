import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { GeographyService } from './geography.service';
import { RequireSession, SessionGuard } from '../auth/session.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionPayload } from '../auth/auth.types';
import { CreateCityDto, CreateRegionDto, CreateSchoolDto, SuggestSchoolDto } from './dto/geography.dto';

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

  @UseGuards(SessionGuard)
  @RequireSession('student')
  @Post('geography/schools/suggest')
  suggest(@Body() dto: SuggestSchoolDto, @CurrentSession() session: SessionPayload) {
    return this.geography.suggestSchool(dto.cityId, dto.nameAr, session.sub);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Post('admin/geography/regions')
  createRegion(@Body() dto: CreateRegionDto) {
    return this.geography.createRegion(dto.nameAr, dto.nameEn);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Post('admin/geography/cities')
  createCity(@Body() dto: CreateCityDto) {
    return this.geography.createCity(dto.regionId, dto.nameAr, dto.nameEn);
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Post('admin/geography/schools')
  createSchool(@Body() dto: CreateSchoolDto) {
    return this.geography.createSchool(dto.cityId, dto.nameAr, dto.nameEn);
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
