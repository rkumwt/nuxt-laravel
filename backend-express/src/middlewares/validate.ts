import type { RequestHandler } from "express";
import type { z } from "zod";
import { toValidationErrors } from "../validation/rules.js";
import { ValidationError } from "../utils/http-error.js";

// FormRequest::rules() — replaces req.body with the parsed, typed data
export const validate =
  (schema: z.ZodType): RequestHandler =>
  async (req, _res, next) => {
    const result = await schema.safeParseAsync(req.body ?? {});
    if (!result.success) {
      throw new ValidationError(toValidationErrors(result.error));
    }
    req.body = result.data;
    next();
  };
