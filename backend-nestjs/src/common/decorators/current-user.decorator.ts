import {
  createParamDecorator,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

const auth = (ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request>();
  if (!request.auth) throw new UnauthorizedException('Unauthenticated');
  return request.auth;
};

// $request->user()
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => auth(ctx).user,
);

// $request->user()->currentAccessToken()
export const CurrentToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => auth(ctx).accessToken,
);
