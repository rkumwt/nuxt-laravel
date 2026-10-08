import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { api, bearer, login, prisma, seedFixtures } from "../helpers.js";

type Fixtures = Awaited<ReturnType<typeof seedFixtures>>;

describe("short URLs", () => {
  let f: Fixtures;

  beforeEach(async () => {
    f = await seedFixtures();
    await prisma.shortUrl.createMany({
      data: [
        {
          companyId: f.client.id,
          createdBy: f.admin.id,
          url: "https://a.example.com",
          shortUrlCode: "AAAAAA",
          createdAt: new Date("2026-09-01T10:00:00Z"),
        },
        {
          companyId: f.client.id,
          createdBy: f.member.id,
          url: "https://b.example.com",
          shortUrlCode: "BBBBBB",
          createdAt: new Date("2026-09-15T10:00:00Z"),
        },
        {
          companyId: f.other.id,
          createdBy: f.outsider.id,
          url: "https://c.example.com",
          shortUrlCode: "CCCCCC",
          createdAt: new Date("2026-09-20T10:00:00Z"),
        },
      ],
    });
  });
  afterAll(() => prisma.$disconnect());

  it("generates a link and recounts company and user totals", async () => {
    const token = await login("admin@example.com");

    const res = await api()
      .post("/api/admin/urls/generate")
      .set(bearer(token))
      .send({ url: "www.example.org/x" });
    expect(res.body).toMatchObject({ status: true, message: "Short URL generated successfully" });

    const created = await prisma.shortUrl.findFirstOrThrow({ where: { url: "www.example.org/x" } });
    expect(created.shortUrlCode).toMatch(/^[A-Za-z0-9]{6}$/);
    expect((await prisma.company.findUniqueOrThrow({ where: { id: f.client.id } })).totalUrls).toBe(
      3,
    );
    expect((await prisma.user.findUniqueOrThrow({ where: { id: f.admin.id } })).totalUrls).toBe(2);
  });

  it("validates the URL", async () => {
    const token = await login("member@example.com");
    const res = await api()
      .post("/api/admin/urls/generate")
      .set(bearer(token))
      .send({ url: "not a url" });

    expect(res.status).toBe(422);
    expect(res.body.errors.url).toEqual([
      "Please enter a valid URL (e.g., https://example.com or www.example.com)",
    ]);
  });

  it("scopes lists: admins see their company, members only their own links", async () => {
    const admin = await api()
      .post("/api/admin/urls")
      .set(bearer(await login("admin@example.com")));
    expect(admin.body.data.data.map((u: { short_url_code: string }) => u.short_url_code)).toEqual([
      "BBBBBB",
      "AAAAAA",
    ]);
    expect(admin.body.data.data[0]).toMatchObject({
      user: "Member",
      client_id: f.client.id,
      short_url: "http://localhost:8001/s/BBBBBB",
    });

    const member = await api()
      .post("/api/admin/urls")
      .set(bearer(await login("member@example.com")));
    expect(member.body.data.meta.total).toBe(1);
    expect(member.body.data.data[0].short_url_code).toBe("BBBBBB");
  });

  it("paginates and filters by date range", async () => {
    const token = await login("superadmin@example.com");

    const page = await api()
      .post("/api/superadmin/urls")
      .set(bearer(token))
      .send({ per_page: 2, page: 2 });
    expect(page.body.data.meta).toEqual({ current_page: 2, last_page: 2, per_page: 2, total: 3 });

    const filtered = await api()
      .post("/api/superadmin/urls")
      .set(bearer(token))
      .send({ start_date: "2026-09-10", end_date: "2026-09-15" });
    expect(
      filtered.body.data.data.map((u: { short_url_code: string }) => u.short_url_code),
    ).toEqual(["BBBBBB"]);

    const byClient = await api()
      .post("/api/superadmin/urls")
      .set(bearer(token))
      .send({ company_id: f.other.id });
    expect(byClient.body.data.data).toHaveLength(1);
    expect(byClient.body.data.data[0]).toMatchObject({ client: "Other Co", client_id: f.other.id });
  });

  it("exports CSV in the Laravel Excel format", async () => {
    const token = await login("superadmin@example.com");
    const res = await api().post("/api/superadmin/urls/download").set(bearer(token));

    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toBe('attachment; filename="urls.csv"');
    expect(res.text.trim().split("\n")).toEqual([
      '"Short URL","Long URL","Hits","Client","Created On"',
      '"CCCCCC","https://c.example.com","0","Other Co","20 Sep 2026"',
      '"BBBBBB","https://b.example.com","0","Demo Company","15 Sep 2026"',
      '"AAAAAA","https://a.example.com","0","Demo Company","01 Sep 2026"',
    ]);
  });

  it("redirects and counts the hit for the link, company and creator", async () => {
    const res = await api().get("/s/BBBBBB");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("https://b.example.com");
    expect(
      (await prisma.shortUrl.findUniqueOrThrow({ where: { shortUrlCode: "BBBBBB" } })).hits,
    ).toBe(1);
    expect(
      (await prisma.company.findUniqueOrThrow({ where: { id: f.client.id } })).totalUrlHits,
    ).toBe(1);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: f.member.id } })).totalUrlHits).toBe(
      1,
    );

    await api().get("/s/nope00").expect(404);
  });
});
