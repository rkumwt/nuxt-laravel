import { Router } from "express";
import { authorize } from "../../middlewares/authorize.js";
import { validate } from "../../middlewares/validate.js";
import type { ShortUrlController } from "./short-url.controller.js";
import {
  allUrlsFilterSchema,
  allUrlsListSchema,
  companyUrlsFilterSchema,
  companyUrlsListSchema,
  generateSchema,
} from "./short-url.schema.js";

// Mounted under /api/superadmin, behind authenticate + authorize("superadmin")
export const superadminShortUrlRoutes = (controller: ShortUrlController) =>
  Router()
    .post("/urls/download", validate(allUrlsFilterSchema), controller.downloadAll)
    .post("/urls", validate(allUrlsListSchema), controller.indexAll);

// Mounted under /api/admin, behind authenticate
export const companyShortUrlRoutes = (controller: ShortUrlController) =>
  Router()
    .use("/urls", authorize("admin", "member"))
    .post("/urls/generate", validate(generateSchema), controller.generate)
    .post("/urls/download", validate(companyUrlsFilterSchema), controller.download)
    .post("/urls", validate(companyUrlsListSchema), controller.index);
