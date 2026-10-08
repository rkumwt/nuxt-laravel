import { registerAs } from '@nestjs/config';

// config/database.php
export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL ?? '',
  logging: process.env.DB_LOGGING === 'true',
}));
