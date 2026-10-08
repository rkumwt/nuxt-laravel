import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Redirect,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Public } from '../../../common/decorators/public.decorator.js';
import { appConfig } from '../../../config/app.config.js';
import { ShortUrlsService } from '../short-urls.service.js';

// Links saved as "www.example.com" (allowed by the validation pattern) need a
// scheme, otherwise the browser would treat them as a path on this host
const absolute = (url: string) =>
  /^https?:\/\//i.test(url) ? url : `http://${url}`;

// routes/web.php (excluded from the /api prefix in configureApp)
@Public()
@Controller()
export class RedirectController {
  constructor(
    private readonly shortUrls: ShortUrlsService,
    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
  ) {}

  @Get('s/:code')
  @Redirect()
  async redirect(@Param('code') code: string) {
    const url = await this.shortUrls.resolve(code);
    if (!url) throw new NotFoundException('Short URL not found');
    return { url: absolute(url), statusCode: 302 };
  }

  // The UI lives in the Nuxt/Next frontend
  @Get()
  @Redirect()
  home() {
    return { url: this.app.frontendUrl, statusCode: 302 };
  }
}
