import type { PaginationDto } from '../dto/pagination.dto.js';

export interface PageRequest {
  page: number;
  perPage: number;
  skip: number;
  take: number;
}

export const toPageRequest = ({
  page,
  per_page,
}: PaginationDto): PageRequest => ({
  page,
  perPage: per_page,
  skip: (page - 1) * per_page,
  take: per_page,
});

export interface Paginated<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export const paginated = <T>(
  items: T[],
  total: number,
  { page, perPage }: PageRequest,
): Paginated<T> => ({
  data: items,
  meta: {
    current_page: page,
    last_page: Math.max(Math.ceil(total / perPage), 1),
    per_page: perPage,
    total,
  },
});
