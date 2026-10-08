import { rateLimit } from "express-rate-limit";
import { sendError } from "../utils/api-response.js";

// Laravel's throttle middleware, applied to login to slow down password guessing
export const loginRateLimiter = (options: { limit: number; skip?: boolean }) =>
  rateLimit({
    windowMs: 60_000,
    limit: options.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // Only failed attempts count, so normal logins never lock anyone out
    skipSuccessfulRequests: true,
    skip: () => options.skip ?? false,
    handler: (_req, res) => sendError(res, "Too Many Attempts.", 429),
  });
