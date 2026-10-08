import type { RequestHandler } from "express";
import type { UserType } from "../generated/prisma/enums.js";
import { ForbiddenError, UnauthenticatedError } from "../utils/http-error.js";

// FormRequest::authorize() — role check after authentication
export const authorize =
  (...allowed: UserType[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) throw new UnauthenticatedError();
    if (!allowed.includes(req.auth.user.type)) throw new ForbiddenError();
    next();
  };
