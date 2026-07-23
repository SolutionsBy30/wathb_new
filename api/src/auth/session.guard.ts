import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { SessionKind } from './auth.types';

export const RequireSession = (...kinds: SessionKind[]) => SetMetadata('sessionKinds', kinds);

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private auth: AuthService,
    private reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
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
    req.session = session;
    return true;
  }
}
