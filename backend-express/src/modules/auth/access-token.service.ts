import { createHash, timingSafeEqual } from "node:crypto";
import type { AccessTokenRepository } from "../../database/repositories/access-token.repository.js";
import { randomString } from "../../utils/random.js";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const safeEqual = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Laravel Sanctum personal access tokens: the client gets "<id>|<random>",
// the database only stores a SHA-256 hash of the random part.
export class AccessTokenService {
  constructor(
    private readonly tokens: AccessTokenRepository,
    private readonly expirationMinutes: number | null,
  ) {}

  async issue(userId: number, name = "api-token") {
    const plain = randomString(40);
    const expiresAt = this.expirationMinutes
      ? new Date(Date.now() + this.expirationMinutes * 60_000)
      : null;

    const record = await this.tokens.create({ userId, name, token: sha256(plain), expiresAt });
    return `${record.id}|${plain}`;
  }

  async verify(bearer: string) {
    const separator = bearer.indexOf("|");
    const hasId = separator > 0;
    const plain = hasId ? bearer.slice(separator + 1) : bearer;
    const hash = sha256(plain);

    const record = hasId
      ? await this.tokens.findWithUser(Number(bearer.slice(0, separator)))
      : await this.tokens.findByHashWithUser(hash);

    if (!record || !safeEqual(record.token, hash)) return null;
    if (record.expiresAt && record.expiresAt <= new Date()) return null;

    await this.tokens.touch(record.id);

    const { user, ...accessToken } = record;
    return { user, accessToken };
  }

  async revoke(tokenId: number) {
    await this.tokens.delete(tokenId);
  }
}
