import { formatDayMonthYear } from '../../common/utils/date.js';
import type { ShortUrl } from './entities/short-url.entity.js';

// ShortUrl::getShortUrlAttribute()
export const shortLink = (appUrl: string, code: string) =>
  `${appUrl}/s/${code}`;

const base = (url: ShortUrl) => ({
  id: url.id,
  url: url.url,
  short_url_code: url.shortUrlCode,
  hits: url.hits,
});

// Superadmin list: shows the client company
export const toClientShortUrlResource =
  (appUrl: string) => (url: ShortUrl) => ({
    ...base(url),
    client: url.creator.company.name,
    client_id: url.creator.company.id,
    created_at: url.createdAt,
    short_url: shortLink(appUrl, url.shortUrlCode),
  });

// Admin/member list: shows who created the link
export const toCompanyShortUrlResource =
  (appUrl: string) => (url: ShortUrl) => ({
    ...base(url),
    user: url.creator.name,
    client_id: url.creator.company.id,
    created_at: url.createdAt,
    short_url: shortLink(appUrl, url.shortUrlCode),
  });

// App\Exports\ShortUrlExport / AdminShortUrlExport
export const CLIENT_EXPORT_HEADINGS = [
  'Short URL',
  'Long URL',
  'Hits',
  'Client',
  'Created On',
];
export const COMPANY_EXPORT_HEADINGS = [
  'Short URL',
  'Long URL',
  'Hits',
  'User',
  'Created On',
];

export const toClientExportRow = (url: ShortUrl) => [
  url.shortUrlCode,
  url.url,
  url.hits,
  url.creator.company.name,
  formatDayMonthYear(url.createdAt),
];

export const toCompanyExportRow = (url: ShortUrl) => [
  url.shortUrlCode,
  url.url,
  url.hits,
  url.creator.name,
  formatDayMonthYear(url.createdAt),
];
