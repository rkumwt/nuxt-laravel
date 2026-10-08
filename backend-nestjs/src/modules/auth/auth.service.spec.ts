import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UsersRepository } from '../../database/repositories/users.repository.js';
import { AccessTokenService } from './access-token.service.js';
import { AuthService } from './auth.service.js';
import { PasswordHasher } from './password-hasher.service.js';

describe('AuthService', () => {
  const user = {
    id: 7,
    name: 'Admin',
    type: 'admin',
    status: 'enabled',
    companyId: 2,
    password: 'hash',
    company: { id: 2, name: 'Demo Company' },
  };
  const users = { findByEmailWithPassword: vi.fn(), findWithCompany: vi.fn() };
  const hasher = { check: vi.fn() };
  const accessTokens = { issue: vi.fn(), revoke: vi.fn() };
  let service: AuthService;

  beforeEach(async () => {
    vi.resetAllMocks();
    // Nest's testing module swaps real providers for mocks, like Laravel's $this->mock()
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersRepository, useValue: users },
        { provide: PasswordHasher, useValue: hasher },
        { provide: AccessTokenService, useValue: accessTokens },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('returns the user resource and a token for valid credentials', async () => {
    users.findByEmailWithPassword.mockResolvedValue(user);
    users.findWithCompany.mockResolvedValue(user);
    hasher.check.mockResolvedValue(true);
    accessTokens.issue.mockResolvedValue('1|token');

    await expect(
      service.login({ email: 'admin@example.com', password: 'secret' }),
    ).resolves.toEqual({
      token: '1|token',
      user: {
        id: 7,
        name: 'Admin',
        type: 'admin',
        status: 'enabled',
        company_id: 2,
        company: { id: 2, name: 'Demo Company' },
      },
    });
    expect(accessTokens.issue).toHaveBeenCalledWith(7);
  });

  it.each([
    ['unknown email', null, false],
    ['wrong password', user, false],
  ])('rejects %s with 403 Invalid credentials', async (_case, found, valid) => {
    users.findByEmailWithPassword.mockResolvedValue(found);
    hasher.check.mockResolvedValue(valid);

    const attempt = service.login({ email: 'x@example.com', password: 'nope' });
    await expect(attempt).rejects.toBeInstanceOf(ForbiddenException);
    await expect(attempt).rejects.toThrow('Invalid credentials');
    expect(accessTokens.issue).not.toHaveBeenCalled();
  });
});
