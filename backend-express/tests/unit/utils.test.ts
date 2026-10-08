import { describe, expect, it } from "vitest";
import { dayRange, formatDayMonthYear } from "../../src/utils/date.js";
import { paginated, paginationSchema, toPageRequest } from "../../src/utils/pagination.js";
import { randomString } from "../../src/utils/random.js";
import { escapeHtml } from "../../src/utils/html.js";

describe("utils", () => {
  it("parses pagination like Laravel's paginator, falling back on bad input", () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, per_page: 10 });
    expect(paginationSchema.parse({ page: "3", per_page: "25" })).toEqual({
      page: 3,
      per_page: 25,
    });
    expect(paginationSchema.parse({ page: "x", per_page: 10_000 })).toEqual({
      page: 1,
      per_page: 10,
    });
  });

  it("builds pagination meta", () => {
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
    expect(formatDayMonthYear(new Date("2026-10-07T23:59:00Z"))).toBe("07 Oct 2026");
    expect(dayRange("2026-10-01", "2026-10-02")).toEqual({
      gte: new Date("2026-10-01T00:00:00.000Z"),
      lte: new Date("2026-10-02T23:59:59.999Z"),
    });
  });

  it("generates random alphanumeric strings", () => {
    expect(randomString(40)).toMatch(/^[A-Za-z0-9]{40}$/);
    expect(randomString(6)).not.toBe(randomString(6));
  });

  it("escapes HTML", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });
});
