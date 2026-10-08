import { z } from "zod";
import { paginationSchema } from "../../utils/pagination.js";
import { optionalDate, optionalInteger, requiredRegex } from "../../validation/rules.js";

// Same pattern as App\Http\Requests\Api\Admin\ShortUrls\ShortUrlsGenerateRequest
const URL_PATTERN =
  /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$/;

export const generateSchema = z.object({
  url: requiredRegex(
    "url",
    URL_PATTERN,
    "Please enter a valid URL (e.g., https://example.com or www.example.com)",
  ),
});

const dateFilters = {
  start_date: optionalDate("start_date"),
  end_date: optionalDate("end_date"),
};

export const companyUrlsFilterSchema = z.object(dateFilters);
export const companyUrlsListSchema = companyUrlsFilterSchema.extend(paginationSchema.shape);

export const allUrlsFilterSchema = z.object({
  ...dateFilters,
  company_id: optionalInteger("company_id"),
});
export const allUrlsListSchema = allUrlsFilterSchema.extend(paginationSchema.shape);

export type GenerateInput = z.infer<typeof generateSchema>;
export type CompanyUrlsFilter = z.infer<typeof companyUrlsFilterSchema>;
export type AllUrlsFilter = z.infer<typeof allUrlsFilterSchema>;
export type CompanyUrlsList = z.infer<typeof companyUrlsListSchema>;
export type AllUrlsList = z.infer<typeof allUrlsListSchema>;
