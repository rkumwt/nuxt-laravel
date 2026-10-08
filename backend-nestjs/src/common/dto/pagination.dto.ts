import { Transform } from 'class-transformer';
import { IsInt } from 'class-validator';

export const MAX_PER_PAGE = 100;

const toInt = (
  value: unknown,
  fallback: number,
  max = Number.MAX_SAFE_INTEGER,
) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : fallback;
};

// Laravel's paginator reads page/per_page from the request and falls back to
// defaults on bad input instead of failing validation
export class PaginationDto {
  @Transform(({ value }: { value: unknown }) => toInt(value, 1))
  @IsInt()
  page: number = 1;

  @Transform(({ value }: { value: unknown }) => toInt(value, 10, MAX_PER_PAGE))
  @IsInt()
  per_page: number = 10;
}
