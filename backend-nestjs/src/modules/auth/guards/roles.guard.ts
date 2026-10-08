import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Roles } from '../../../common/decorators/roles.decorator.js';

// FormRequest::authorize(): runs after AccessTokenGuard, before validation
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride(Roles, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const user = context.switchToHttp().getRequest<Request>().auth?.user;
    if (!user || !roles.includes(user.type)) {
      throw new ForbiddenException('This action is unauthorized.');
    }
    return true;
  }
}
