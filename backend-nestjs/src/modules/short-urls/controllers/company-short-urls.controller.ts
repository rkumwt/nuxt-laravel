import { Body, Controller, StreamableFile } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator.js';
import { PostAction } from '../../../common/decorators/post-action.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { toCsvStream } from '../../../common/utils/csv.js';
import { toPageRequest } from '../../../common/utils/pagination.js';
import type { User } from '../../users/entities/user.entity.js';
import { UserType } from '../../users/user-type.enum.js';
import {
  CompanyUrlsFilterDto,
  CompanyUrlsListDto,
  GenerateUrlDto,
} from '../dto/short-url.dto.js';
import { COMPANY_EXPORT_HEADINGS } from '../short-url.resource.js';
import { ShortUrlsService } from '../short-urls.service.js';
import { CsvDownload } from './csv.js';

// Api\Admin\ShortUrlsController (admins see their company, members their own links)
@Roles([UserType.Admin, UserType.Member])
@Controller('admin/urls')
export class CompanyShortUrlsController {
  constructor(private readonly shortUrls: ShortUrlsService) {}

  @PostAction('generate', 'Short URL generated successfully')
  async generate(@CurrentUser() user: User, @Body() dto: GenerateUrlDto) {
    await this.shortUrls.generate(user, dto.url);
  }

  @CsvDownload('download', 'urls.csv')
  download(@CurrentUser() user: User, @Body() filter: CompanyUrlsFilterDto) {
    return new StreamableFile(
      toCsvStream(
        COMPANY_EXPORT_HEADINGS,
        this.shortUrls.exportForUser(user, filter),
      ),
    );
  }

  @PostAction('', 'Short Urls fetched successfully')
  index(@CurrentUser() user: User, @Body() dto: CompanyUrlsListDto) {
    return this.shortUrls.listForUser(user, dto, toPageRequest(dto));
  }
}
