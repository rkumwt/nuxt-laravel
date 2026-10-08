import type { PrismaClient } from "../generated/prisma/client.js";
import type { DbClient } from "./client.js";
import { AccessTokenRepository } from "./repositories/access-token.repository.js";
import { CompanyRepository } from "./repositories/company.repository.js";
import { InvitationRepository } from "./repositories/invitation.repository.js";
import { ShortUrlRepository } from "./repositories/short-url.repository.js";
import { UserRepository } from "./repositories/user.repository.js";

export const createRepositories = (db: DbClient) => ({
  accessTokens: new AccessTokenRepository(db),
  companies: new CompanyRepository(db),
  invitations: new InvitationRepository(db),
  shortUrls: new ShortUrlRepository(db),
  users: new UserRepository(db),
});

export type Repositories = ReturnType<typeof createRepositories>;

// Runs several repository calls atomically (DB::transaction)
export class UnitOfWork {
  constructor(private readonly prisma: PrismaClient) {}

  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => work(createRepositories(tx)));
  }
}
