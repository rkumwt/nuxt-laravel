import { HttpStatus, UnprocessableEntityException } from '@nestjs/common';

export type ValidationErrors = Record<string, string[]>;

// 422 with Laravel's { field: [messages] } error bag
export class ValidationException extends UnprocessableEntityException {
  constructor(
    public readonly errors: ValidationErrors,
    message = 'Validation error',
  ) {
    super({ statusCode: HttpStatus.UNPROCESSABLE_ENTITY, message, errors });
  }

  static withMessage(field: string, message: string) {
    return new ValidationException({ [field]: [message] });
  }
}
