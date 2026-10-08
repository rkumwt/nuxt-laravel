import { Router } from "express";
import { authorize } from "../../middlewares/authorize.js";
import { validate } from "../../middlewares/validate.js";
import { paginationSchema } from "../../utils/pagination.js";
import { teamMemberInviteSchema } from "../invitations/invitation.schema.js";
import type { TeamMemberController } from "./team-member.controller.js";

// Mounted under /api/admin, behind authenticate
export const teamMemberRoutes = (controller: TeamMemberController) =>
  Router()
    .use("/team-members", authorize("admin"))
    .post("/team-members/invite", validate(teamMemberInviteSchema), controller.invite)
    .post("/team-members", validate(paginationSchema), controller.index);
