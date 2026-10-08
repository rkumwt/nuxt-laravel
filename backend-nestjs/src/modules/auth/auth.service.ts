import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersRepository } from '../../database/repositories/users.repository.js';
import { AccessTokenService } from './access-token.service.js';
import { toAuthUserResource } from './auth.resource.js';
import type { LoginDto } from './dto/login.dto.js';
import { PasswordHasher } from './password-hasher.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly hasher: PasswordHasher,
    private readonly accessTokens: AccessTokenService,
  ) {}

  async login({ email, password }: LoginDto) {
    const user = await this.users.findByEmailWithPassword(email);

    if (!user || !(await this.hasher.check(password, user.password))) {
      throw new ForbiddenException('Invalid credentials');
    }

    const token = await this.accessTokens.issue(user.id);
    return { user: await this.profile(user.id), token };
  }

  async profile(userId: number) {
    const user = await this.users.findWithCompany(userId);
    if (!user) throw new UnauthorizedException('Unauthenticated');
    return toAuthUserResource(user);
  }

  logout(tokenId: number) {
    return this.accessTokens.revoke(tokenId);
  }
}
