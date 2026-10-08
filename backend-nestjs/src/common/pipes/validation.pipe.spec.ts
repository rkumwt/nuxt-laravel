import type { ArgumentMetadata } from '@nestjs/common';
import { LoginDto } from '../../modules/auth/dto/login.dto.js';
import { RegisterDto } from '../../modules/invitations/dto/register.dto.js';
import {
  AllUrlsListDto,
  GenerateUrlDto,
} from '../../modules/short-urls/dto/short-url.dto.js';
import { ValidationException } from '../exceptions/validation.exception.js';
import { createValidationPipe } from './validation.pipe.js';

const pipe = createValidationPipe();
const body = (metatype: ArgumentMetadata['metatype']): ArgumentMetadata => ({
  type: 'body',
  metatype,
});

const errorsFor = async (
  metatype: ArgumentMetadata['metatype'],
  value: unknown,
) => {
  try {
    await pipe.transform(value, body(metatype));
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationException);
    return (error as ValidationException).errors;
  }
  throw new Error('Expected validation to fail');
};

describe('validation pipe (Laravel-compatible messages)', () => {
  it('reports one message per field, required first', async () => {
    expect(
      await errorsFor(LoginDto, { email: 'not-an-email', password: '   ' }),
    ).toEqual({
      email: ['The email field must be a valid email address.'],
      password: ['The password field is required.'],
    });
  });

  it('reports every failing field at once, including same:password', async () => {
    expect(
      await errorsFor(RegisterDto, {
        password: 'short',
        password_confirmation: 'other',
      }),
    ).toEqual({
      name: ['The name field is required.'],
      email: ['The email field is required.'],
      password: ['The password field must be at least 8 characters.'],
      password_confirmation: [
        'The password confirmation field must match password.',
      ],
    });
  });

  it('uses the custom URL message', async () => {
    expect(await errorsFor(GenerateUrlDto, { url: 'not a url' })).toEqual({
      url: [
        'Please enter a valid URL (e.g., https://example.com or www.example.com)',
      ],
    });
  });

  it('trims strings and strips undeclared fields', async () => {
    const dto = await pipe.transform(
      { email: '  a@b.co ', password: 'secret', is_admin: true },
      body(LoginDto),
    );
    expect(dto).toEqual({ email: 'a@b.co', password: 'secret' });
  });

  it('falls back to default pagination and validates filters', async () => {
    const dto = await pipe.transform(
      { page: 'x', per_page: 10_000, company_id: '7' },
      body(AllUrlsListDto),
    );
    expect(dto).toMatchObject({ page: 1, per_page: 10, company_id: 7 });

    expect(
      await errorsFor(AllUrlsListDto, {
        start_date: '07/10/2026',
        company_id: 'abc',
      }),
    ).toEqual({
      start_date: ['The start date field must match the format Y-m-d.'],
      company_id: ['The company id field must be an integer.'],
    });
  });
});
