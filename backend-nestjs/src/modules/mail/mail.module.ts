import { Global, Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { mailConfig } from '../../config/mail.config.js';
import { LogMailer, MAILER, SmtpMailer } from './mailer.js';

// Factory provider: picks the Mailer implementation from configuration.
// Tests swap it with overrideProvider(MAILER).
@Global()
@Module({
  providers: [
    {
      provide: MAILER,
      inject: [mailConfig.KEY],
      useFactory: (config: ConfigType<typeof mailConfig>) =>
        config.mailer === 'smtp' ? new SmtpMailer(config) : new LogMailer(),
    },
  ],
  exports: [MAILER],
})
export class MailModule {}
