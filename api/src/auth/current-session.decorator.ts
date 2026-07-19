import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SessionPayload } from './auth.types';

export const CurrentSession = createParamDecorator((_data: unknown, ctx: ExecutionContext): SessionPayload => {
  const req = ctx.switchToHttp().getRequest();
  return req.session;
});
