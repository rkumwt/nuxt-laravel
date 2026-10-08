import type { Request, Response } from "express";
import type { BodyRequest } from "../../types/http.js";
import { sendSuccess } from "../../utils/api-response.js";
import type { RegisterInput } from "./invitation.schema.js";
import type { InvitationService } from "./invitation.service.js";

type CodeParams = { code: string };

export class InvitationController {
  constructor(private readonly invitations: InvitationService) {}

  show = async (req: Request<CodeParams>, res: Response) => {
    const invitation = await this.invitations.findByCode(req.params.code);
    sendSuccess(res, "Information fetched successfully", { data: invitation });
  };

  register = async (req: BodyRequest<RegisterInput, CodeParams>, res: Response) => {
    await this.invitations.register(req.params.code, req.body);
    sendSuccess(res, "Registration completed successfully. Now you can login.");
  };
}
