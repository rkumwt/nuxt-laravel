import type { Response } from "express";
import type { ValidationErrors } from "./http-error.js";

// Same envelope as the Laravel ApiBaseController: { status, message, data | errors }
export const sendSuccess = (res: Response, message = "Success", data: unknown = [], status = 200) =>
  res.status(status).json({ status: true, message, data });

export const sendError = (
  res: Response,
  message = "Something went wrong",
  status = 400,
  errors: ValidationErrors | [] = [],
) => res.status(status).json({ status: false, message, errors });
