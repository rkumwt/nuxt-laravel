import { Router, type RequestHandler } from "express";
import { validate } from "../../middlewares/validate.js";
import type { AuthController } from "./auth.controller.js";
import { loginSchema } from "./auth.schema.js";

export const authRoutes = (
  controller: AuthController,
  { authenticate, loginLimiter }: { authenticate: RequestHandler; loginLimiter: RequestHandler },
) =>
  Router()
    .post("/login", loginLimiter, validate(loginSchema), controller.login)
    .post("/logout", authenticate, controller.logout)
    .post("/user", authenticate, controller.user);
