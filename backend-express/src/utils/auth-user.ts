import type { Request } from "express";
import { UnauthenticatedError } from "./http-error.js";

// $request->user() — only call after the authenticate middleware
export const authUser = (req: Request) => {
  if (!req.auth) throw new UnauthenticatedError();
  return req.auth.user;
};
