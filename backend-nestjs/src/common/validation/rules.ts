import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

// Decorators that reproduce Laravel's validation rules and English messages
// (lang/en/validation.php). The ValidationPipe runs with stopAtFirstError, so
// the order inside each helper is the order Laravel would report.

export const label = (field: string) => field.replace(/_/g, ' ');

// Laravel's TrimStrings + ConvertEmptyStringsToNull middleware
export const TrimToUndefined = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value ?? undefined;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  });

/** required|string */
export const Required = (field: string) =>
  applyDecorators(
    TrimToUndefined(),
    IsDefined({ message: `The ${label(field)} field is required.` }),
    IsString({ message: `The ${label(field)} field must be a string.` }),
  );

/** nullable|string */
export const OptionalString = (field: string) =>
  applyDecorators(
    TrimToUndefined(),
    IsOptional(),
    IsString({ message: `The ${label(field)} field must be a string.` }),
  );

/** required|email */
export const RequiredEmail = (field: string) =>
  applyDecorators(
    Required(field),
    IsEmail(
      {},
      { message: `The ${label(field)} field must be a valid email address.` },
    ),
  );

/** required|min:n */
export const RequiredMin = (field: string, min: number) =>
  applyDecorators(
    Required(field),
    MinLength(min, {
      message: `The ${label(field)} field must be at least ${min} characters.`,
    }),
  );

/** required|in:a,b */
export const RequiredIn = (field: string, values: readonly string[]) =>
  applyDecorators(
    Required(field),
    IsIn(values, { message: `The selected ${label(field)} is invalid.` }),
  );

/** required|regex:pattern with a custom message */
export const RequiredRegex = (
  field: string,
  pattern: RegExp,
  message: string,
) => applyDecorators(Required(field), Matches(pattern, { message }));

/** nullable|date_format:Y-m-d */
export const OptionalDate = (field: string) =>
  applyDecorators(
    TrimToUndefined(),
    IsOptional(),
    Matches(/^\d{4}-\d{2}-\d{2}$/, {
      message: `The ${label(field)} field must match the format Y-m-d.`,
    }),
  );

/** nullable|integer */
export const OptionalInteger = (field: string) =>
  applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      value === '' || value == null ? undefined : Number(value),
    ),
    IsOptional(),
    IsInt({ message: `The ${label(field)} field must be an integer.` }),
    IsPositive({ message: `The ${label(field)} field must be an integer.` }),
  );
