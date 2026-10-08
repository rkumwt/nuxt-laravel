import { RequestMethod } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { useContainer } from 'class-validator';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { appConfig } from './config/app.config.js';

// HTTP-level setup shared by main.ts and the e2e tests
export function configureApp(app: NestExpressApplication) {
  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  app.set('trust proxy', config.trustProxy);
  app.use(helmet());
  app.enableCors({
    origin: config.corsOrigins,
    exposedHeaders: ['Content-Disposition'],
  });

  // routes/api.php under /api; routes/web.php stays at the root
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 's/:code', method: RequestMethod.GET },
      { path: 'up', method: RequestMethod.GET },
      { path: '/', method: RequestMethod.GET },
    ],
  });

  // Lets class-validator constraints (IsUnique) receive injected services
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // Close DB connections on SIGTERM / SIGINT
  app.enableShutdownHooks();

  return app;
}
