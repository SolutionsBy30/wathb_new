import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { SessionKind } from './auth.types';

export const RequireSession = (...kinds: SessionKind[]) => SetMetadata('sessionKinds', kinds);

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

    const needsStepUp = this.reflector.getAllAndOverride<boolean>('requireStepUp', [ctx.getHandler(), ctx.getClass()]) ?? false;
    // A distinct message (checked by the frontend) — this must read as
    // "verify again", not "log in again" like a plain expired/missing session.
    if (needsStepUp && !isStepUpFresh(session.stepUpAt, Date.now())) {
      throw new UnauthorizedException('step-up verification required');
    }

    req.session = session;
    return true;
  }
}
