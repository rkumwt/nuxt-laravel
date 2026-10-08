import { User } from '../src/modules/users/entities/user.entity.js';
import { bearer, createTestApp, type TestApp } from './helpers.js';

describe('invitations (e2e)', () => {
  let t: TestApp;

  const register = (code: string, body: Record<string, string>) =>
    t
      .api()
      .post(`/api/invitation/${code}/register`)
      .send({
        name: 'New Person',
        email: 'ignored@example.com',
        password: 'password1',
        password_confirmation: 'password1',
        ...body,
      });

  const findUser = (email: string) =>
    t.dataSource
      .getRepository(User)
      .findOneOrFail({ where: { email }, relations: { company: true } });

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => t.seedFixtures());
  afterAll(() => t.app.close());

  it('superadmin invites a client who signs up with a new company', async () => {
    const token = await t.login('superadmin@example.com');
    await t
      .api()
      .post('/api/superadmin/clients/invite')
      .set(bearer(token))
      .send({ name: 'Client', email: 'client@new.test' })
      .expect(200);

    expect(t.mailer.sent.at(-1)).toMatchObject({
      to: 'client@new.test',
      subject: 'Invitation mail from Sembark',
    });
    const code = t.mailer.lastInviteCode()!;

    const info = await t.api().post(`/api/invitation/${code}`);
    expect(info.body.data.data).toMatchObject({
      email: 'client@new.test',
      company: { name: 'Sembark', is_global: 1 },
    });

    const missingCompany = await register(code, {});
    expect(missingCompany.status).toBe(422);
    expect(missingCompany.body.errors).toEqual({
      company_name: ['The company name field is required.'],
    });

    await register(code, { company_name: 'Fresh Co' }).expect(200);

    // The account uses the invited address, not the posted one
    const user = await findUser('client@new.test');
    expect(user).toMatchObject({
      type: 'admin',
      status: 'enabled',
      company: { name: 'Fresh Co', isGlobal: false },
    });

    // Codes are single-use
    await t.api().post(`/api/invitation/${code}`).expect(400);
  });

  it('admin invites a team member into their own company with a role', async () => {
    const token = await t.login('admin@example.com');
    await t
      .api()
      .post('/api/admin/team-members/invite')
      .set(bearer(token))
      .send({ name: 'Teammate', email: 'mate@new.test', role: 'member' })
      .expect(200);

    expect(t.mailer.sent.at(-1)?.subject).toBe('Invitation from Demo Company');
    await register(t.mailer.lastInviteCode()!, {}).expect(200);

    const user = await findUser('mate@new.test');
    expect(user).toMatchObject({
      type: 'member',
      company: { name: 'Demo Company', totalUsers: 3 },
    });
  });

  it('validates invites like unique:users,email, together with other rules', async () => {
    const token = await t.login('superadmin@example.com');
    const res = await t
      .api()
      .post('/api/superadmin/clients/invite')
      .set(bearer(token))
      .send({ name: '', email: 'admin@example.com' });

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual({
      name: ['The name field is required.'],
      email: ['The email has already been taken.'],
    });
  });

  it('reports mail failures with 403 like the Laravel app', async () => {
    const token = await t.login('superadmin@example.com');
    t.mailer.failNext = true;

    const res = await t
      .api()
      .post('/api/superadmin/clients/invite')
      .set(bearer(token))
      .send({ name: 'Client', email: 'client2@new.test' });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe(
      'Failed to send invitation email. Please check mail configuration.',
    );
  });
});
