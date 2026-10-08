import { registerAs } from '@nestjs/config';

// config/auth.php + config/hashing.php + config/sanctum.php
export const authConfig = registerAs('auth', () => ({
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 12),
  tokenExpirationMinutes: process.env.TOKEN_EXPIRATION_MINUTES
    ? Number(process.env.TOKEN_EXPIRATION_MINUTES)
    : null,
  loginRateLimit: Number(process.env.LOGIN_RATE_LIMIT ?? 10),
}));
