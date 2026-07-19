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
    const allowedKinds = this.reflector.get<SessionKind[]>('sessionKinds', ctx.getHandler()) ?? [];
    if (allowedKinds.length > 0 && !allowedKinds.includes(session.kind)) {
      throw new UnauthorizedException('session not permitted for this route');
    }
    req.session = session;
    return true;
  }
}
