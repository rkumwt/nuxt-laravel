import { AccessTokenService } from './access-token.service.js';
import type { AccessTokensRepository } from '../../database/repositories/access-tokens.repository.js';

// In-memory stand-in for the repository
const fakeRepository = () => {
  const rows = new Map<number, Record<string, unknown>>();
  let nextId = 1;
  const withUser = (row?: Record<string, unknown>) =>
    row ? { ...row, user: { id: row.userId } } : null;

  return {
    rows,
    create: async (data: Record<string, unknown>) => {
      const row = { id: nextId++, ...data };
      rows.set(row.id, row);
      return row;
    },
    findWithUser: async (id: number) => withUser(rows.get(id)),
    findByHashWithUser: async (token: string) =>
      withUser([...rows.values()].find((r) => r.token === token)),
    touch: async () => undefined,
    delete: async (id: number) => void rows.delete(id),
  };
};

const createService = (expirationMinutes: number | null = null) => {
  const repo = fakeRepository();
  const service = new AccessTokenService(
    repo as unknown as AccessTokensRepository,
    {
      bcryptRounds: 4,
      tokenExpirationMinutes: expirationMinutes,
      loginRateLimit: 10,
    },
  );
  return { repo, service };
};

describe('AccessTokenService', () => {
  it('issues Sanctum-style tokens and stores only a hash', async () => {
    const { repo, service } = createService();
    const token = await service.issue(42);

    expect(token).toMatch(/^1\|[A-Za-z0-9]{40}$/);
    expect(repo.rows.get(1)?.token).toMatch(/^[a-f0-9]{64}$/);
    expect(repo.rows.get(1)?.token).not.toContain(token.split('|')[1]);
  });

  it('verifies valid tokens with or without the id prefix', async () => {
    const { service } = createService();
    const token = await service.issue(42);

    expect((await service.verify(token))?.user).toEqual({ id: 42 });
    expect((await service.verify(token.split('|')[1]!))?.user).toEqual({
      id: 42,
    });
  });

  it('rejects forged, revoked and expired tokens', async () => {
    const { repo, service } = createService(1);
    const token = await service.issue(42);
    const [id] = token.split('|');

    expect(await service.verify(`${id}|${'x'.repeat(40)}`)).toBeNull();
    expect(await service.verify('abc|def')).toBeNull();

    repo.rows.get(1)!.expiresAt = new Date(Date.now() - 1000);
    expect(await service.verify(token)).toBeNull();

    await service.revoke(1);
    expect(await service.verify(token)).toBeNull();
  });
});
