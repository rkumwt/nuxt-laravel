import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map } from 'rxjs';
import { ResponseMessage } from '../decorators/response-message.decorator.js';

// ApiBaseController::success(): wraps handlers marked with @ResponseMessage /
// @PostAction in { status: true, message, data }. Others (CSV downloads,
// redirects, health) pass through untouched.
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const message = this.reflector.get(ResponseMessage, context.getHandler());
    if (message === undefined) return next.handle();

    return next
      .handle()
      .pipe(
        map((data: unknown) => ({ status: true, message, data: data ?? [] })),
      );
  }
}
