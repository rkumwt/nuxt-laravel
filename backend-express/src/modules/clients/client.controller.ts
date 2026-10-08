import type { Response } from "express";
import type { BodyRequest } from "../../types/http.js";
import { sendSuccess } from "../../utils/api-response.js";
import { toPageRequest, type PaginationInput } from "../../utils/pagination.js";
import type { InviteInput } from "../invitations/invitation.schema.js";
import type { ClientService } from "./client.service.js";

export class ClientController {
  constructor(private readonly clients: ClientService) {}

  index = async (req: BodyRequest<PaginationInput>, res: Response) => {
    const result = await this.clients.list(toPageRequest(req.body));
    sendSuccess(res, "Clients fetched successfully", result);
  };

  invite = async (req: BodyRequest<InviteInput>, res: Response) => {
    await this.clients.invite(req.body);
    sendSuccess(res, "Invitation send successfully");
  };
}
