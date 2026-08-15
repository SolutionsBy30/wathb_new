import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { SessionKind } from './auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AdminPermission, hasAdminPermission } from '../admin-ops/admin-permissions';

export const RequireSession = (...kinds: SessionKind[]) => SetMetadata('sessionKinds', kinds);

/**
 * ADM-088 — gate an admin route on a console permission.
 *
 * Hiding a nav item is a courtesy; this is the control. Every admin route
 * that maps to a nav section carries one of these, so an admin without the
 * permission gets a 403 whether they came through the UI or curl.
 *
 * Class-level works, method-level overrides — same resolution as
 * @RequireSession, via getAllAndOverride.
 */
export const RequirePermission = (permission: AdminPermission) => SetMetadata('adminPermission', permission);

// STU-029 — "sensitive account actions ... shall require step-up
// authentication via a fresh OTP." A step-up-elevated session is only valid
// for a short window after re-verification (AuthController.stepUpVerify),
// not for the session's whole remaining 24h lifetime — otherwise "fresh OTP"
// would mean nothing after the first use.
export const RequireStepUp = () => SetMetadata('requireStepUp', true);
export const STEP_UP_VALIDITY_SECONDS = 10 * 60;

export function isStepUpFresh(stepUpAt: number | undefined, now: number): boolean {
  return !!stepUpAt && now - stepUpAt <= STEP_UP_VALIDITY_SECONDS * 1000;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private auth: AuthService,
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('missing session token');

    const session = this.auth.verifySession(token);
    // getAllAndOverride checks the handler first, falling back to the
    // controller class — a plain .get(key, ctx.getHandler()) (the previous
    // code here) silently ignores class-level @RequireSession() entirely,
    // since SetMetadata attaches to whichever target it decorates and a
    // method-scoped lookup never sees class-scoped metadata. That left
    // every controller relying solely on a class-level @RequireSession
    // (QuestionsController, NotificationsController, OverviewController,
    // AdminOpsController — all admin-only; WathbController — student-only)
    // open to ANY authenticated session, of any role — confirmed live: a
    // student OTP token could call GET /admin/questions and get a 200 with
    // the full bank. Method-level metadata still wins where both are
    // present, so controllers that already mix roles per-route (e.g.
    // PeopleController) are unaffected by this fix.
    const allowedKinds = this.reflector.getAllAndOverride<SessionKind[]>('sessionKinds', [ctx.getHandler(), ctx.getClass()]) ?? [];
    if (allowedKinds.length > 0 && !allowedKinds.includes(session.kind)) {
      throw new UnauthorizedException('session not permitted for this route');
    }

    const needsStepUp = this.reflector.getAllAndOverride<boolean>('requireStepUp', [ctx.getHandler(), ctx.getClass()]) ?? false;
    // A distinct message (checked by the frontend) — this must read as
    // "verify again", not "log in again" like a plain expired/missing session.
    if (needsStepUp && !isStepUpFresh(session.stepUpAt, Date.now())) {
      throw new UnauthorizedException('step-up verification required');
    }

    req.session = session;

    // ADM-088 — permissions are read from the database on every admin
    // request, not lifted off the JWT. An admin token lives 12 hours, so a
    // permission revoked (or an account disabled) at 9am would otherwise
    // keep working until evening. One indexed primary-key lookup is a fair
    // price for "revoke means revoke", and it closes the same staleness gap
    // for suspension, which the token also could not express.
    const requiredPermission = this.reflector.getAllAndOverride<AdminPermission>('adminPermission', [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (requiredPermission) {
      if (session.kind !== 'admin') throw new ForbiddenException('admin session required');
      const admin = await this.prisma.user.findUnique({
        where: { id: session.sub },
        select: { role: true, status: true, isSuperAdmin: true, adminPermissions: true },
      });
      if (!admin || admin.role !== 'admin' || admin.status === 'suspended') {
        throw new UnauthorizedException('admin account is no longer active');
      }
      if (!hasAdminPermission(admin, requiredPermission)) {
        throw new ForbiddenException(`missing permission: ${requiredPermission}`);
      }
      req.admin = admin;
    }

    return true;
  }
}
