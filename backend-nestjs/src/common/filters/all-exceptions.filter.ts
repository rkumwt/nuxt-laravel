import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ThrottlerException } from '@nestjs/throttler';
import { ValidationException } from '../exceptions/validation.exception.js';

// Laravel's exception handler: every error becomes { status: false, message, errors }
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly exposeErrors: boolean,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const { httpAdapter } = this.adapterHost;
    const response = host.switchToHttp().getResponse();
    const { status, message, errors } = this.describe(exception);

    httpAdapter.reply(response, { status: false, message, errors }, status);
  }

  private describe(exception: unknown): {
    status: number;
    message: string;
    errors: unknown;
  } {
    if (exception instanceof ValidationException) {
      return {
        status: exception.getStatus(),
        message: 'Validation error',
        errors: exception.errors,
      };
    }

    if (exception instanceof ThrottlerException) {
      return {
        status: HttpStatus.TOO_MANY_REQUESTS,
        message: 'Too Many Attempts.',
        errors: [],
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const raw =
        typeof body === 'string'
          ? body
          : (body as { message?: unknown }).message;
      let message = Array.isArray(raw)
        ? raw.join(' ')
        : typeof raw === 'string'
          ? raw
          : exception.message;

      // Router 404s ("Cannot POST /api/x") and malformed JSON get Laravel-style messages
      if (status === HttpStatus.NOT_FOUND && message.startsWith('Cannot ')) {
        message = 'Not Found';
      }
      if (status === HttpStatus.BAD_REQUEST && message.includes('JSON')) {
        message = 'Malformed JSON in request body.';
      }
      return { status, message, errors: [] };
    }

    this.logger.error(
      exception instanceof Error ? exception.stack : exception,
      'Unhandled error',
    );
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message:
        this.exposeErrors && exception instanceof Error
          ? exception.message
          : 'Server Error',
      errors: [],
    };
  }
}
