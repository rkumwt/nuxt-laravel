import { plainToInstance, Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from 'class-validator';

// Empty strings in .env mean "not set"
const blankToUndefined = ({ value }: { value: unknown }) =>
  value === '' ? undefined : value;

const urlOptions = { require_tld: false, require_protocol: true };

export class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV = 'development';

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  PORT = 8002;

  @IsUrl(urlOptions)
  APP_URL = 'http://localhost:8002';

  @IsUrl(urlOptions)
  FRONTEND_URL = 'http://localhost:3000';

  @Transform(blankToUndefined)
  @IsOptional()
  @IsString()
  CORS_ALLOWED_ORIGINS?: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(0)
  TRUST_PROXY = 0;

  @IsIn(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
  LOG_LEVEL = 'info';

  @IsString()
  DATABASE_URL!: string;

  @Transform(({ value }) => value === true || value === 'true')
  DB_LOGGING = false;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(4)
  @Max(15)
  BCRYPT_ROUNDS = 12;

  @Transform(({ value }) =>
    value === '' || value == null ? undefined : Number(value),
  )
  @IsOptional()
  @IsInt()
  @Min(1)
  TOKEN_EXPIRATION_MINUTES?: number;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  LOGIN_RATE_LIMIT = 10;

  @IsIn(['smtp', 'log'])
  MAIL_MAILER = 'log';

  @Transform(blankToUndefined)
  @IsOptional()
  @IsString()
  MAIL_HOST?: string;

  @Transform(({ value }) => Number(value))
  @IsInt()
  MAIL_PORT = 587;

  @Transform(blankToUndefined)
  @IsOptional()
  @IsString()
  MAIL_USERNAME?: string;

  @Transform(blankToUndefined)
  @IsOptional()
  @IsString()
  MAIL_PASSWORD?: string;

  @IsEmail()
  MAIL_FROM_ADDRESS = 'hello@example.com';

  @IsString()
  MAIL_FROM_NAME = 'UrlShortner';
}

// ConfigModule `validate` hook: fail fast on boot with every problem listed
export function validateEnv(config: Record<string, unknown>) {
  const env = plainToInstance(EnvironmentVariables, config, {
    exposeDefaultValues: true,
  });
  const errors = validateSync(env, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map(
        (e) =>
          `${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`,
      )
      .join('\n  ');
    throw new Error(`Invalid environment variables:\n  ${details}`);
  }
  return env;
}
