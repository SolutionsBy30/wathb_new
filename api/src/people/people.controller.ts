import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { StudentsService } from './students.service';
import { SupervisorsService } from './supervisors.service';
import { RequireSession, SessionGuard } from '../auth/session.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionPayload } from '../auth/auth.types';
import { CreateStudentDto, CreateSupervisorDto, GoalSetupDto, InviteSupervisorDto, StudentNotificationPrefsDto, SupervisorPreferencesDto } from './dto/people.dto';

@UseGuards(SessionGuard)
@Controller()
export class PeopleController {
  constructor(
    private students: StudentsService,
    private supervisors: SupervisorsService,
  ) {}

  @RequireSession('admin')
  @Post('admin/students')
  createStudent(@Body() dto: CreateStudentDto) {
    return this.students.createStudent(dto.mobile, dto.name);
  }

  @RequireSession('admin')
  @Post('admin/supervisors')
  createSupervisor(@Body() dto: CreateSupervisorDto) {
    return this.supervisors.createSupervisor(dto.mobile, dto.name, dto.type);
  }

  @RequireSession('admin')
  @Get('admin/students/search')
  searchStudent(@Query('mobile') mobile: string) {
    return this.students.searchByMobile(mobile);
  }

  @RequireSession('student')
  @Get('students/me')
  me(@CurrentSession() session: SessionPayload) {
    return this.students.me(session.sub);
  }

  @RequireSession('student')
  @Patch('students/me/goal')
  setGoal(@Body() dto: GoalSetupDto, @CurrentSession() session: SessionPayload) {
    return this.students.setGoal(session.sub, dto);
  }

  @RequireSession('student')
  @Patch('students/me/notification-prefs')
  setNotificationPrefs(@Body() dto: StudentNotificationPrefsDto, @CurrentSession() session: SessionPayload) {
    return this.students.setNotificationPrefs(session.sub, dto);
  }

  @RequireSession('student')
  @Get('students/me/supervisors')
  listSupervisors(@CurrentSession() session: SessionPayload) {
    return this.students.listSupervisors(session.sub);
  }

  @RequireSession('student')
  @Post('students/me/supervisors/invite')
  invite(@Body() dto: InviteSupervisorDto, @CurrentSession() session: SessionPayload) {
    return this.supervisors.invite(session.sub, dto.mobile, dto.name, dto.type);
  }

  @RequireSession('student')
  @Post('students/me/supervisors/:id/revoke')
  revoke(@Param('id') id: string, @CurrentSession() session: SessionPayload) {
    return this.supervisors.revoke(session.sub, id);
  }

  @RequireSession('supervisor')
  @Post('supervisors/me/invites/:id/accept')
  accept(@Param('id') id: string, @CurrentSession() session: SessionPayload) {
    return this.supervisors.acceptInvite(session.sub, id);
  }

  @RequireSession('supervisor')
  @Get('supervisors/me/dashboard')
  dashboard(@CurrentSession() session: SessionPayload) {
    return this.supervisors.dashboard(session.sub);
  }

  @RequireSession('supervisor')
  @Get('supervisors/me/preferences')
  getPreferences(@CurrentSession() session: SessionPayload) {
    return this.supervisors.getPreferences(session.sub);
  }

  @RequireSession('supervisor')
  @Patch('supervisors/me/preferences')
  setPreferences(@Body() dto: SupervisorPreferencesDto, @CurrentSession() session: SessionPayload) {
    return this.supervisors.setPreferences(session.sub, dto);
  }
}
