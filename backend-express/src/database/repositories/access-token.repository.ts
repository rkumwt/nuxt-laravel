import type { DbClient } from "../client.js";

export class AccessTokenRepository {
  constructor(private readonly db: DbClient) {}

  create(data: { userId: number; name: string; token: string; expiresAt: Date | null }) {
    return this.db.personalAccessToken.create({ data });
  }

  findWithUser(id: number) {
    return this.db.personalAccessToken.findUnique({ where: { id }, include: { user: true } });
  }

  findByHashWithUser(token: string) {
    return this.db.personalAccessToken.findUnique({ where: { token }, include: { user: true } });
  }

  touch(id: number) {
    return this.db.personalAccessToken.update({ where: { id }, data: { lastUsedAt: new Date() } });
  }

  delete(id: number) {
    return this.db.personalAccessToken.deleteMany({ where: { id } });
  }
}
