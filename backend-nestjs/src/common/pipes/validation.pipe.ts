import { ValidationPipe, type ValidationError } from '@nestjs/common';
import {
  ValidationException,
  type ValidationErrors,
} from '../exceptions/validation.exception.js';

const collect = (
  errors: ValidationError[],
  prefix = '',
  bag: ValidationErrors = {},
) => {
  for (const error of errors) {
    const key = prefix + error.property;
    if (error.constraints) bag[key] = Object.values(error.constraints);
    if (error.children?.length) collect(error.children, `${key}.`, bag);
  }
  return bag;
};

// FormRequest equivalent: validates and transforms request DTOs, strips
// undeclared fields (like $request->validated()) and reports Laravel's shape
export const createValidationPipe = () =>
  new ValidationPipe({
    transform: true,
    whitelist: true,
    stopAtFirstError: true,
    exceptionFactory: (errors) => new ValidationException(collect(errors)),
  });
