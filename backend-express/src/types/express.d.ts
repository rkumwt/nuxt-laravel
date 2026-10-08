import type { PersonalAccessToken, User } from "../generated/prisma/client.js";

declare global {
  namespace Express {
    interface Request {
      // Set by the authenticate middleware
      auth?: { user: User; accessToken: PersonalAccessToken };
    }
  }
}

export {};
