import { IntersectionType } from '@nestjs/mapped-types';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';
import {
  OptionalDate,
  OptionalInteger,
  RequiredRegex,
} from '../../../common/validation/rules.js';

// Same pattern as App\Http\Requests\Api\Admin\ShortUrls\ShortUrlsGenerateRequest
const URL_PATTERN =
  /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$/;

export class GenerateUrlDto {
  @RequiredRegex(
    'url',
    URL_PATTERN,
    'Please enter a valid URL (e.g., https://example.com or www.example.com)',
  )
  url: string;
}

// Admin/member filters
export class CompanyUrlsFilterDto {
  @OptionalDate('start_date')
  start_date?: string;

  @OptionalDate('end_date')
  end_date?: string;
}

// Superadmin filters: + optional client company
export class AllUrlsFilterDto extends CompanyUrlsFilterDto {
  @OptionalInteger('company_id')
  company_id?: number;
}

export class CompanyUrlsListDto extends IntersectionType(
  CompanyUrlsFilterDto,
  PaginationDto,
) {}
export class AllUrlsListDto extends IntersectionType(
  AllUrlsFilterDto,
  PaginationDto,
) {}
