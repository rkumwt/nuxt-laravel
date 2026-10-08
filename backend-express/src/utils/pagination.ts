import { z } from "zod";

export const MAX_PER_PAGE = 100;

// Laravel's paginator falls back to page 1 / the default size on bad input
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1).default(1),
  per_page: z.coerce.number().int().min(1).max(MAX_PER_PAGE).catch(10).default(10),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export interface PageRequest {
  page: number;
  perPage: number;
  skip: number;
  take: number;
}

export const toPageRequest = ({ page, per_page }: PaginationInput): PageRequest => ({
  page,
  perPage: per_page,
  skip: (page - 1) * per_page,
  take: per_page,
});

export interface Paginated<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
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
