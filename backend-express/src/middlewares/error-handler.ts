import type { ErrorRequestHandler, RequestHandler } from "express";
import type { Logger } from "../lib/logger.js";
import { sendError } from "../utils/api-response.js";
import { HttpError, NotFoundError } from "../utils/http-error.js";

export const notFoundHandler: RequestHandler = () => {
  throw new NotFoundError();
};

// Laravel's exception handler: known errors become JSON, everything else is a 500
export const errorHandler =
  (logger: Logger, exposeErrors: boolean): ErrorRequestHandler =>
  (err, _req, res, next) => {
    // A streamed response (CSV) already started; let Express close the socket
    if (res.headersSent) return next(err);

    if (err instanceof HttpError) {
      return sendError(res, err.message, err.status, err.errors);
    }

    // body-parser errors (malformed JSON, payload too large)
    if (err?.type === "entity.parse.failed") {
      return sendError(res, "Malformed JSON in request body.", 400);
    }
    if (typeof err?.status === "number" && err.status < 500 && err.expose) {
      return sendError(res, err.message, err.status);
    }

    logger.error({ err }, "Unhandled error");
    return sendError(res, exposeErrors ? String(err?.message ?? err) : "Server Error", 500);
  };
