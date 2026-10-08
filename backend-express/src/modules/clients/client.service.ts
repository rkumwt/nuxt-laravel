import type { Repositories } from "../../database/unit-of-work.js";
import { inviteClientMail } from "../../mail/templates/invitations.js";
import { HttpError } from "../../utils/http-error.js";
import { paginated, type PageRequest } from "../../utils/pagination.js";
import type { InviteInput } from "../invitations/invitation.schema.js";
import type { InvitationService } from "../invitations/invitation.service.js";
import { toClientResource } from "./client.resource.js";

export class ClientService {
  constructor(
    private readonly repos: Repositories,
    private readonly invitations: InvitationService,
  ) {}

  async list(page: PageRequest) {
    const { items, total } = await this.repos.companies.paginateClients(page);
    return paginated(items.map(toClientResource), total, page);
  }

  // Clients are invited into the global company and get their own company on signup
  async invite({ name, email }: InviteInput) {
    await this.invitations.assertEmailAvailable(email);

    const globalCompany = await this.repos.companies.findGlobal();
    if (!globalCompany) throw new HttpError(500, "The global company has not been seeded.");

    await this.invitations.send({
      name,
      email,
      companyId: globalCompany.id,
      companyName: globalCompany.name,
      role: "admin",
      template: inviteClientMail,
    });
  }
}
