import { bearer, createTestApp, type TestApp } from './helpers.js';

describe('auth (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => t.seedFixtures());
  afterAll(() => t.app.close());

  it('logs in and returns a Sanctum-style token with the user', async () => {
    const res = await t
      .api()
      .post('/api/login')
      .send({ email: 'admin@example.com', password: '12345678' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: true,
      message: 'Login successful',
      data: {
        user: {
          name: 'Admin',
          type: 'admin',
          status: 'enabled',
          company: { name: 'Demo Company' },
        },
      },
    });
    expect(res.body.data.token).toMatch(/^\d+\|[A-Za-z0-9]{40}$/);
    expect(res.body.data.user).not.toHaveProperty('password');
  });

  it('rejects wrong credentials with 403', async () => {
    const res = await t
      .api()
      .post('/api/login')
      .send({ email: 'admin@example.com', password: 'wrong-pass' });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      status: false,
      message: 'Invalid credentials',
      errors: [],
    });
  });

  it('returns Laravel-style validation errors', async () => {
    const res = await t
      .api()
      .post('/api/login')
      .send({ email: 'not-an-email', password: '  ' });

    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      status: false,
      message: 'Validation error',
      errors: {
        email: ['The email field must be a valid email address.'],
        password: ['The password field is required.'],
      },
    });
  });

  it('returns the current user and revokes the token on logout', async () => {
    const token = await t.login('member@example.com');

    const me = await t.api().post('/api/user').set(bearer(token));
    expect(me.body.data.user).toMatchObject({ name: 'Member', type: 'member' });

    const out = await t.api().post('/api/logout').set(bearer(token));
    expect(out.body).toEqual({
      status: true,
      message: 'Logged out successfully',
      data: [],
    });

    const after = await t.api().post('/api/user').set(bearer(token));
    expect(after.status).toBe(401);
    expect(after.body).toEqual({
      status: false,
      message: 'Unauthenticated',
      errors: [],
    });
  });

  it('rejects missing, malformed and forged tokens', async () => {
    const token = await t.login('admin@example.com');
    const [id] = token.split('|');

    await t.api().post('/api/user').expect(401);
    await t
      .api()
      .post('/api/user')
      .set({ Authorization: 'Basic abc' })
      .expect(401);
    await t
      .api()
      .post('/api/user')
      .set(bearer(`${id}|${'x'.repeat(40)}`))
      .expect(401);
  });

  it('answers unknown routes and bad JSON in the same envelope', async () => {
    const missing = await t.api().post('/api/nope');
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({
      status: false,
      message: 'Not Found',
      errors: [],
    });

    const bad = await t
      .api()
      .post('/api/login')
      .set('Content-Type', 'application/json')
      .send('{bad');
    expect(bad.status).toBe(400);
    expect(bad.body.message).toBe('Malformed JSON in request body.');
  });
});
