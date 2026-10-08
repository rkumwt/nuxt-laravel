import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator.js';
import { AccessTokenService } from '../access-token.service.js';

// auth:sanctum, registered globally (APP_GUARD): every route needs a valid
// "Authorization: Bearer <id>|<token>" unless it is marked @Public()
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokens: AccessTokenService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const [scheme, bearer] = (request.headers.authorization ?? '').split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !bearer) {
      throw new UnauthorizedException('Unauthenticated');
    }

    const auth = await this.accessTokens.verify(bearer);
    if (!auth) throw new UnauthorizedException('Unauthenticated');

    request.auth = auth;
    return true;
  }
}
