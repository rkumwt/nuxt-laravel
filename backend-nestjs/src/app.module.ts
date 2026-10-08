import { Module } from '@nestjs/common';
import { ConfigModule, type ConfigType } from '@nestjs/config';
import {
  APP_FILTER,
  APP_GUARD,
  APP_INTERCEPTOR,
  APP_PIPE,
  HttpAdapterHost,
} from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor.js';
import { createValidationPipe } from './common/pipes/validation.pipe.js';
import { appConfig } from './config/app.config.js';
import { authConfig } from './config/auth.config.js';
import { databaseConfig } from './config/database.config.js';
import { validateEnv } from './config/env.validation.js';
import { mailConfig } from './config/mail.config.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AccessTokenGuard } from './modules/auth/guards/access-token.guard.js';
import { RolesGuard } from './modules/auth/guards/roles.guard.js';
import { ClientsModule } from './modules/clients/clients.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { InvitationsModule } from './modules/invitations/invitations.module.js';
import { MailModule } from './modules/mail/mail.module.js';
import { ShortUrlsModule } from './modules/short-urls/short-urls.module.js';
import { TeamMembersModule } from './modules/team-members/team-members.module.js';

@Module({
  imports: [
    // .env + typed, validated config namespaces (config/*.php)
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
      load: [appConfig, authConfig, databaseConfig, mailConfig],
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [appConfig.KEY],
      useFactory: (app: ConfigType<typeof appConfig>) => ({
        pinoHttp: {
          level: app.logLevel,
          autoLogging: !app.isTest,
          redact: ['req.headers.authorization', 'req.headers.cookie'],
          ...(app.env === 'development' && {
            transport: { target: 'pino-pretty', options: { singleLine: true } },
          }),
        },
      }),
    }),
    // Login throttling (applied with @UseGuards(ThrottlerGuard) on the route)
    ThrottlerModule.forRootAsync({
      inject: [authConfig.KEY, appConfig.KEY],
      useFactory: (
        auth: ConfigType<typeof authConfig>,
        app: ConfigType<typeof appConfig>,
      ) => ({
        throttlers: [{ ttl: 60_000, limit: auth.loginRateLimit }],
        skipIf: () => app.isTest,
      }),
    }),
    DatabaseModule,
    MailModule,
    AuthModule,
    InvitationsModule,
    ClientsModule,
    TeamMembersModule,
    ShortUrlsModule,
    HealthModule,
  ],
  providers: [
    // Global request pipeline, in Laravel's order:
    // auth:sanctum (401) → authorize() (403) → rules() (422) → controller
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_PIPE, useFactory: createValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
    {
      provide: APP_FILTER,
      inject: [HttpAdapterHost, appConfig.KEY],
      useFactory: (
        adapterHost: HttpAdapterHost,
        app: ConfigType<typeof appConfig>,
      ) => new AllExceptionsFilter(adapterHost, !app.isProduction),
    },
  ],
})
export class AppModule {}
