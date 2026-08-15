import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { RequireSession, SessionGuard } from '../auth/session.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionPayload } from '../auth/auth.types';
import { CreateAdminDto, UpdateAdminDto } from './dto/admin-user.dto';

/**
 * ADM-088 — admin accounts.
 *
 * Deliberately NOT gated with @RequirePermission: "who may create admins" is
 * the super-admin flag, not a permission anyone can be granted by ticking a
 * box in the same list as everything else. AdminUsersService.assertSuperAdmin
 * enforces it on every mutation, re-read from the database each time.
 */
@UseGuards(SessionGuard)
@RequireSession('admin')
@Controller('admin/admins')
export class AdminUsersController {
  constructor(private admins: AdminUsersService) {}

  /**
   * Any admin may call this — it returns only the caller's own identity and
   * permissions, which the console needs to decide what to render.
   */
  @Get('me')
  me(@CurrentSession() session: SessionPayload) {
    return this.admins.me(session.sub);
  }

  /** The permission vocabulary with Arabic labels, for the checkbox list. */
  @Get('permissions')
  catalogue() {
    return this.admins.catalogue();
  }

  @Get()
  list() {
    return this.admins.list();
  }

  @Post()
  create(@Body() dto: CreateAdminDto, @CurrentSession() session: SessionPayload) {
    return this.admins.create(session.sub, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAdminDto, @CurrentSession() session: SessionPayload) {
    return this.admins.update(session.sub, id, dto);
  }
}
