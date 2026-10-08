import type { RequestHandler } from "express";
import type { AccessTokenService } from "../modules/auth/access-token.service.js";
import { UnauthenticatedError } from "../utils/http-error.js";

// auth:sanctum — resolves "Authorization: Bearer <id>|<token>" to a user
export const authenticate =
  (accessTokens: AccessTokenService): RequestHandler =>
  async (req, _res, next) => {
    const header = req.headers.authorization ?? "";
    const [scheme, bearer] = header.split(" ");

    if (scheme?.toLowerCase() !== "bearer" || !bearer) {
      throw new UnauthenticatedError();
    }

    const result = await accessTokens.verify(bearer);
    if (!result) {
      throw new UnauthenticatedError();
    }

    req.auth = result;
    next();
  };
