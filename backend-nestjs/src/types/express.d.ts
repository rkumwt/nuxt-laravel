import type { PersonalAccessToken } from '../modules/auth/entities/personal-access-token.entity.js';
import type { User } from '../modules/users/entities/user.entity.js';

declare global {
  namespace Express {
    interface Request {
      // Set by AccessTokenGuard
      auth?: { user: User; accessToken: PersonalAccessToken };
    }
  }
}

export {};
