import { registerAs } from '@nestjs/config';

// config/mail.php
export const mailConfig = registerAs('mail', () => ({
  mailer: (process.env.MAIL_MAILER ?? 'log') as 'smtp' | 'log',
  host: process.env.MAIL_HOST || undefined,
  port: Number(process.env.MAIL_PORT ?? 587),
  username: process.env.MAIL_USERNAME || undefined,
  password: process.env.MAIL_PASSWORD || undefined,
  from: {
    address: process.env.MAIL_FROM_ADDRESS ?? 'hello@example.com',
    name: process.env.MAIL_FROM_NAME ?? 'UrlShortner',
  },
}));
