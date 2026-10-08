import type { Repositories } from "../../database/unit-of-work.js";
import type { PasswordHasher } from "../../lib/hash.js";
import { ForbiddenError, UnauthenticatedError } from "../../utils/http-error.js";
import type { AccessTokenService } from "./access-token.service.js";
import type { LoginInput } from "./auth.schema.js";
import { toAuthUserResource } from "./auth.resource.js";

export class AuthService {
  constructor(
    private readonly repos: Repositories,
    private readonly hasher: PasswordHasher,
    private readonly accessTokens: AccessTokenService,
  ) {}

  async login({ email, password }: LoginInput) {
    const user = await this.repos.users.findByEmail(email);

    if (!user || !(await this.hasher.check(password, user.password))) {
      throw new ForbiddenError("Invalid credentials");
    }

    const token = await this.accessTokens.issue(user.id);
    return { user: await this.profile(user.id), token };
  }

  async profile(userId: number) {
    const user = await this.repos.users.findWithCompany(userId);
    if (!user) throw new UnauthenticatedError();
    return toAuthUserResource(user);
  }

  logout(tokenId: number) {
    return this.accessTokens.revoke(tokenId);
  }
}
