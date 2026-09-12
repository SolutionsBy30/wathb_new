import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SchoolAdminService } from './school-admin.service';
import { GrantSchoolAdminDto, SetDisclosureDto, SetSchoolAdminActiveDto } from './dto/school.dto';
import { RequirePermission, RequireSession, SessionGuard } from '../auth/session.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionPayload } from '../auth/auth.types';

/**
 * SCH-005 — وثب-side control of school access.
 *
 * Rides on the existing 'geography' permission, which already governs schools
 * and their approval. A separate permission would mean an admin who can create
 * a school but not decide who reads it, which is not a distinction anyone
 * asked for.
 */
@UseGuards(SessionGuard)
@RequireSession('admin')
@RequirePermission('geography')
@Controller('admin/schools')
export class SchoolAdminController {
  constructor(private schools: SchoolAdminService) {}

  // Literal path, declared before anything with a ':schoolId'.
  @Get('access')
  schoolsWithAccess() {
    return this.schools.schoolsWithAccess();
  }

  @Get('admins')
  listAdmins(@Query('schoolId') schoolId?: string) {
    return this.schools.list(schoolId || undefined);
  }

  @Post('admins')
  grant(@Body() dto: GrantSchoolAdminDto, @CurrentSession() session: SessionPayload) {
    return this.schools.grant(dto, session.sub);
  }

  @Post('admins/:id/active')
  setActive(@Param('id') id: string, @Body() dto: SetSchoolAdminActiveDto, @CurrentSession() session: SessionPayload) {
    return this.schools.setActive(id, dto.isActive, session.sub);
  }

  @Post(':schoolId/disclosure')
  setDisclosure(@Param('schoolId') schoolId: string, @Body() dto: SetDisclosureDto, @CurrentSession() session: SessionPayload) {
    return this.schools.setDisclosure(schoolId, dto.disclosure, session.sub);
  }
}
