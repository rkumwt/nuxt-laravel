import { Router } from "express";
import { validate } from "../../middlewares/validate.js";
import { paginationSchema } from "../../utils/pagination.js";
import { inviteSchema } from "../invitations/invitation.schema.js";
import type { ClientController } from "./client.controller.js";

// Mounted under /api/superadmin, behind authenticate + authorize("superadmin")
export const clientRoutes = (controller: ClientController) =>
  Router()
    .post("/clients/invite", validate(inviteSchema), controller.invite)
    .post("/clients", validate(paginationSchema), controller.index);
