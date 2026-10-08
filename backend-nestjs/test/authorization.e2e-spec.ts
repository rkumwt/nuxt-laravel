import { bearer, createTestApp, type TestApp } from './helpers.js';

describe('role authorization (e2e)', () => {
  let t: TestApp;
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    t = await createTestApp();
    await t.seedFixtures();
    for (const role of ['superadmin', 'admin', 'member']) {
      tokens[role] = await t.login(`${role}@example.com`);
    }
  });
  afterAll(() => t.app.close());

  it.each([
    ['admin', '/api/superadmin/clients'],
    ['member', '/api/superadmin/urls'],
    ['member', '/api/admin/team-members'],
    ['superadmin', '/api/admin/urls'],
    ['superadmin', '/api/admin/team-members/invite'],
  ])('%s cannot access %s', async (role, path) => {
    const res = await t.api().post(path).set(bearer(tokens[role]!));

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('This action is unauthorized.');
  });

  it.each([
    ['superadmin', '/api/superadmin/clients'],
    ['admin', '/api/admin/team-members'],
    ['admin', '/api/admin/urls'],
    ['member', '/api/admin/urls'],
  ])('%s can access %s', async (role, path) => {
    await t.api().post(path).set(bearer(tokens[role]!)).expect(200);
  });

  it('checks authentication before authorization, and authorization before validation', async () => {
    await t.api().post('/api/superadmin/clients').expect(401);
    // Invalid body, wrong role: 403 wins over 422 (FormRequest::authorize runs first)
    await t
      .api()
      .post('/api/admin/team-members/invite')
      .set(bearer(tokens.member!))
      .send({})
      .expect(403);
  });
});
