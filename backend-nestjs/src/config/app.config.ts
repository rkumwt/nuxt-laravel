import { registerAs } from '@nestjs/config';

const trimSlash = (url: string) => url.replace(/\/$/, '');

// config/app.php + config/cors.php
export const appConfig = registerAs('app', () => {
  const env = process.env.NODE_ENV ?? 'development';
  const frontendUrl = trimSlash(
    process.env.FRONTEND_URL ?? 'http://localhost:3000',
  );

  return {
    env,
    isProduction: env === 'production',
    isTest: env === 'test',
    port: Number(process.env.PORT ?? 8002),
    url: trimSlash(process.env.APP_URL ?? 'http://localhost:8002'),
    frontendUrl,
    corsOrigins: (process.env.CORS_ALLOWED_ORIGINS || frontendUrl)
      .split(',')
      .map((origin) => origin.trim()),
    trustProxy: Number(process.env.TRUST_PROXY ?? 0),
    logLevel: process.env.LOG_LEVEL ?? 'info',
  };
});
