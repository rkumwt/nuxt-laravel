import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';
import { appConfig } from './config/app.config.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  configureApp(app);

  const config = app.get(appConfig.KEY);
  await app.listen(config.port);
  app
    .get(Logger)
    .log(`API listening on ${config.url} (port ${config.port}, ${config.env})`);
}
await bootstrap();
