import { Module } from '@nestjs/common';
import { CompanyShortUrlsController } from './controllers/company-short-urls.controller.js';
import { RedirectController } from './controllers/redirect.controller.js';
import { SuperadminShortUrlsController } from './controllers/superadmin-short-urls.controller.js';
import { ShortUrlsService } from './short-urls.service.js';

@Module({
  controllers: [
    SuperadminShortUrlsController,
    CompanyShortUrlsController,
    RedirectController,
  ],
  providers: [ShortUrlsService],
})
export class ShortUrlsModule {}
