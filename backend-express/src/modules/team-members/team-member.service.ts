import type { Repositories } from "../../database/unit-of-work.js";
import type { User } from "../../generated/prisma/client.js";
import { inviteTeamMemberMail } from "../../mail/templates/invitations.js";
import { NotFoundError } from "../../utils/http-error.js";
import { paginated, type PageRequest } from "../../utils/pagination.js";
import type { TeamMemberInviteInput } from "../invitations/invitation.schema.js";
import type { InvitationService } from "../invitations/invitation.service.js";
import { toTeamMemberResource } from "./team-member.resource.js";

export class TeamMemberService {
  constructor(
    private readonly repos: Repositories,
    private readonly invitations: InvitationService,
  ) {}

  async list(admin: User, page: PageRequest) {
    const { items, total } = await this.repos.users.paginateByCompany(admin.companyId, page);
    return paginated(items.map(toTeamMemberResource), total, page);
  }

  async invite(admin: User, { name, email, role }: TeamMemberInviteInput) {
    await this.invitations.assertEmailAvailable(email);

    const user = await this.repos.users.findWithCompany(admin.id);
    if (!user) throw new NotFoundError();

    await this.invitations.send({
      name,
      email,
      companyId: user.company.id,
      companyName: user.company.name,
      role,
      template: inviteTeamMemberMail,
    });
  }
}
