import { dayRange, formatDayMonthYear } from './date.js';
import { escapeHtml } from './html.js';
import { paginated, toPageRequest } from './pagination.js';
import { randomString } from './random.js';

describe('utils', () => {
  it('builds pagination meta', () => {
    const page = toPageRequest({ page: 2, per_page: 10 });
    expect(page).toEqual({ page: 2, perPage: 10, skip: 10, take: 10 });
    expect(paginated([], 0, page).meta).toEqual({
      current_page: 2,
      last_page: 1,
      per_page: 10,
      total: 0,
    });
    expect(paginated([], 21, page).meta.last_page).toBe(3);
  });

  it("formats dates like Carbon's d M Y and builds inclusive day ranges", () => {
    expect(formatDayMonthYear(new Date('2026-10-07T23:59:00Z'))).toBe(
      '07 Oct 2026',
    );
    expect(dayRange('2026-10-01', '2026-10-02')).toEqual({
      from: new Date('2026-10-01T00:00:00.000Z'),
      to: new Date('2026-10-02T23:59:59.999Z'),
    });
  });

  it('generates random alphanumeric strings and escapes HTML', () => {
    expect(randomString(40)).toMatch(/^[A-Za-z0-9]{40}$/);
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });
});
