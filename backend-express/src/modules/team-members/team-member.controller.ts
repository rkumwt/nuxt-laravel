import type { Response } from "express";
import type { BodyRequest } from "../../types/http.js";
import { sendSuccess } from "../../utils/api-response.js";
import { authUser } from "../../utils/auth-user.js";
import { toPageRequest, type PaginationInput } from "../../utils/pagination.js";
import type { TeamMemberInviteInput } from "../invitations/invitation.schema.js";
import type { TeamMemberService } from "./team-member.service.js";

export class TeamMemberController {
  constructor(private readonly teamMembers: TeamMemberService) {}

  index = async (req: BodyRequest<PaginationInput>, res: Response) => {
    const result = await this.teamMembers.list(authUser(req), toPageRequest(req.body));
    sendSuccess(res, "Team members fetched successfully", result);
  };

  invite = async (req: BodyRequest<TeamMemberInviteInput>, res: Response) => {
    await this.teamMembers.invite(authUser(req), req.body);
    sendSuccess(res, "Invitation send successfully");
  };
}
