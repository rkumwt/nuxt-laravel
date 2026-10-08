import { Router } from "express";
import { validate } from "../../middlewares/validate.js";
import type { InvitationController } from "./invitation.controller.js";
import { registerSchema } from "./invitation.schema.js";

export const invitationRoutes = (controller: InvitationController) =>
  Router()
    .post("/invitation/:code/register", validate(registerSchema), controller.register)
    .post("/invitation/:code", controller.show);
