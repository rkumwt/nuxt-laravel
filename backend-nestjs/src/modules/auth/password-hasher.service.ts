import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import { authConfig } from '../../config/auth.config.js';

// Laravel's Hash facade (bcrypt driver)
@Injectable()
export class PasswordHasher {
  constructor(
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  make(plain: string) {
    return bcrypt.hash(plain, this.config.bcryptRounds);
  }

  check(plain: string, hashed: string | null | undefined) {
    if (!hashed) return Promise.resolve(false);
    return bcrypt.compare(plain, hashed);
  }
}
