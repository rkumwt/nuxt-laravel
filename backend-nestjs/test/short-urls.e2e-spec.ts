import { ShortUrl } from '../src/modules/short-urls/entities/short-url.entity.js';
import { Company } from '../src/modules/companies/entities/company.entity.js';
import { User } from '../src/modules/users/entities/user.entity.js';
import { bearer, createTestApp, type TestApp } from './helpers.js';

describe('short URLs (e2e)', () => {
  let t: TestApp;
  let f: Awaited<ReturnType<TestApp['seedFixtures']>>;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    f = await t.seedFixtures();
    await t.dataSource.getRepository(ShortUrl).insert([
      {
        companyId: f.client.id,
        createdBy: f.admin.id,
        url: 'https://a.example.com',
        shortUrlCode: 'AAAAAA',
        createdAt: new Date('2026-09-01T10:00:00Z'),
      },
      {
        companyId: f.client.id,
        createdBy: f.member.id,
        url: 'https://b.example.com',
        shortUrlCode: 'BBBBBB',
        createdAt: new Date('2026-09-15T10:00:00Z'),
      },
      {
        companyId: f.other.id,
        createdBy: f.outsider.id,
        url: 'https://c.example.com',
        shortUrlCode: 'CCCCCC',
        createdAt: new Date('2026-09-20T10:00:00Z'),
      },
    ]);
  });
  afterAll(() => t.app.close());

  const codes = (res: {
    body: { data: { data: { short_url_code: string }[] } };
  }) => res.body.data.data.map((u) => u.short_url_code);

  it('generates a link and recounts company and user totals', async () => {
    const token = await t.login('admin@example.com');
    const res = await t
      .api()
      .post('/api/admin/urls/generate')
      .set(bearer(token))
      .send({ url: 'www.example.org/x' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: true,
      message: 'Short URL generated successfully',
      data: [],
    });

    const created = await t.dataSource
      .getRepository(ShortUrl)
      .findOneByOrFail({ url: 'www.example.org/x' });
    expect(created.shortUrlCode).toMatch(/^[A-Za-z0-9]{6}$/);
    expect(
      (
        await t.dataSource
          .getRepository(Company)
          .findOneByOrFail({ id: f.client.id })
      ).totalUrls,
    ).toBe(3);
    expect(
      (
        await t.dataSource
          .getRepository(User)
          .findOneByOrFail({ id: f.admin.id })
      ).totalUrls,
    ).toBe(2);
  });

  it('validates the URL', async () => {
    const token = await t.login('member@example.com');
    const res = await t
      .api()
      .post('/api/admin/urls/generate')
      .set(bearer(token))
      .send({ url: 'not a url' });

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual({
      url: [
        'Please enter a valid URL (e.g., https://example.com or www.example.com)',
      ],
    });
  });

  it('scopes lists: admins see their company, members only their own links', async () => {
    const admin = await t
      .api()
      .post('/api/admin/urls')
      .set(bearer(await t.login('admin@example.com')));
    expect(codes(admin)).toEqual(['BBBBBB', 'AAAAAA']);
    expect(admin.body.data.data[0]).toMatchObject({
      user: 'Member',
      client_id: f.client.id,
      short_url: 'http://localhost:8002/s/BBBBBB',
    });

    const member = await t
      .api()
      .post('/api/admin/urls')
      .set(bearer(await t.login('member@example.com')));
    expect(member.body.data.meta.total).toBe(1);
    expect(codes(member)).toEqual(['BBBBBB']);
  });

  it('paginates and filters by date range and client', async () => {
    const token = await t.login('superadmin@example.com');

    const page = await t
      .api()
      .post('/api/superadmin/urls')
      .set(bearer(token))
      .send({ per_page: 2, page: 2 });
    expect(page.body.data.meta).toEqual({
      current_page: 2,
      last_page: 2,
      per_page: 2,
      total: 3,
    });
    expect(codes(page)).toEqual(['AAAAAA']);

    const filtered = await t
      .api()
      .post('/api/superadmin/urls')
      .set(bearer(token))
      .send({ start_date: '2026-09-10', end_date: '2026-09-15' });
    expect(codes(filtered)).toEqual(['BBBBBB']);

    const byClient = await t
      .api()
      .post('/api/superadmin/urls')
      .set(bearer(token))
      .send({ company_id: f.other.id });
    expect(byClient.body.data.data).toEqual([
      expect.objectContaining({ client: 'Other Co', client_id: f.other.id }),
    ]);
  });

  it('exports CSV in the Laravel Excel format', async () => {
    const token = await t.login('superadmin@example.com');
    const res = await t
      .api()
      .post('/api/superadmin/urls/download')
      .set(bearer(token));

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="urls.csv"',
    );
    expect(res.text.trim().split('\n')).toEqual([
      '"Short URL","Long URL","Hits","Client","Created On"',
      '"CCCCCC","https://c.example.com","0","Other Co","20 Sep 2026"',
      '"BBBBBB","https://b.example.com","0","Demo Company","15 Sep 2026"',
      '"AAAAAA","https://a.example.com","0","Demo Company","01 Sep 2026"',
    ]);
  });

  it('redirects and counts the hit for the link, company and creator', async () => {
    const res = await t.api().get('/s/BBBBBB');

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('https://b.example.com');
    expect(
      (
        await t.dataSource
          .getRepository(ShortUrl)
          .findOneByOrFail({ shortUrlCode: 'BBBBBB' })
      ).hits,
    ).toBe(1);
    expect(
      (
        await t.dataSource
          .getRepository(Company)
          .findOneByOrFail({ id: f.client.id })
      ).totalUrlHits,
    ).toBe(1);
    expect(
      (
        await t.dataSource
          .getRepository(User)
          .findOneByOrFail({ id: f.member.id })
      ).totalUrlHits,
    ).toBe(1);

    await t.api().get('/s/nope00').expect(404);
  });

  it('serves the health check outside the /api prefix', async () => {
    const res = await t.api().get('/up');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
