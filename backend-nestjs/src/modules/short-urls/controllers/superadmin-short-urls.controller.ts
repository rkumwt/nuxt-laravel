import { Body, Controller, StreamableFile } from '@nestjs/common';
import { PostAction } from '../../../common/decorators/post-action.decorator.js';
import { Roles } from '../../../common/decorators/roles.decorator.js';
import { toCsvStream } from '../../../common/utils/csv.js';
import { toPageRequest } from '../../../common/utils/pagination.js';
import { UserType } from '../../users/user-type.enum.js';
import { AllUrlsFilterDto, AllUrlsListDto } from '../dto/short-url.dto.js';
import { CLIENT_EXPORT_HEADINGS } from '../short-url.resource.js';
import { ShortUrlsService } from '../short-urls.service.js';
import { CsvDownload } from './csv.js';

// Api\Superadmin\ShortUrlsController
@Roles([UserType.Superadmin])
@Controller('superadmin/urls')
export class SuperadminShortUrlsController {
  constructor(private readonly shortUrls: ShortUrlsService) {}

  @CsvDownload('download', 'urls.csv')
  download(@Body() filter: AllUrlsFilterDto) {
    return new StreamableFile(
      toCsvStream(CLIENT_EXPORT_HEADINGS, this.shortUrls.exportAll(filter)),
    );
  }

  @PostAction('', 'Short Urls fetched successfully')
  index(@Body() dto: AllUrlsListDto) {
    return this.shortUrls.listAll(dto, toPageRequest(dto));
  }
}
