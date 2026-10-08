import { createHash, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { randomString } from '../../common/utils/random.js';
import { authConfig } from '../../config/auth.config.js';
import { AccessTokensRepository } from '../../database/repositories/access-tokens.repository.js';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

const safeEqual = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Laravel Sanctum personal access tokens: the client gets "<id>|<random>",
// the database only stores a SHA-256 hash of the random part.
@Injectable()
export class AccessTokenService {
  constructor(
    private readonly tokens: AccessTokensRepository,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  async issue(userId: number, name = 'api-token') {
    const plain = randomString(40);
    const minutes = this.config.tokenExpirationMinutes;
    const expiresAt = minutes ? new Date(Date.now() + minutes * 60_000) : null;

    const record = await this.tokens.create({
      userId,
      name,
      token: sha256(plain),
      expiresAt,
    });
    return `${record.id}|${plain}`;
  }

  async verify(bearer: string) {
    const separator = bearer.indexOf('|');
    const hasId = separator > 0;
    const plain = hasId ? bearer.slice(separator + 1) : bearer;
    const hash = sha256(plain);
    const id = Number(bearer.slice(0, separator));

    if (hasId && !Number.isInteger(id)) return null;

    const record = hasId
      ? await this.tokens.findWithUser(id)
      : await this.tokens.findByHashWithUser(hash);

    if (!record || !safeEqual(record.token, hash)) return null;
    if (record.expiresAt && record.expiresAt <= new Date()) return null;

    await this.tokens.touch(record.id);

    const { user, ...accessToken } = record;
    return { user, accessToken: accessToken as typeof record };
  }

  revoke(tokenId: number) {
    return this.tokens.delete(tokenId);
  }
}
