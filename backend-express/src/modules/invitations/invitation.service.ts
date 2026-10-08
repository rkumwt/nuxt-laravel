import type { Repositories, UnitOfWork } from "../../database/unit-of-work.js";
import type { UserType } from "../../generated/prisma/enums.js";
import type { PasswordHasher } from "../../lib/hash.js";
import type { Mailer } from "../../mail/mailer.js";
import type { InvitationMailData } from "../../mail/templates/invitations.js";
import { BadRequestError, ForbiddenError, ValidationError } from "../../utils/http-error.js";
import { randomString } from "../../utils/random.js";
import { uniqueMessage } from "../../validation/rules.js";
import type { RegisterInput } from "./invitation.schema.js";
import { toInvitationResource } from "./invitation.resource.js";

export interface SendInvitationInput {
  name: string;
  email: string;
  companyId: number;
  companyName: string;
  role: UserType;
  template: (data: InvitationMailData) => { subject: string; html: string };
}

export class InvitationService {
  constructor(
    private readonly repos: Repositories,
    private readonly uow: UnitOfWork,
    private readonly hasher: PasswordHasher,
    private readonly mailer: Mailer,
    private readonly frontendUrl: string,
  ) {}

  async findByCode(code: string) {
    const invitation = await this.repos.invitations.findByCode(code);
    if (!invitation) throw new BadRequestError("Invitation code not exists");
    return toInvitationResource(invitation);
  }

  // Throws the same error as Laravel's unique:users,email rule
  async assertEmailAvailable(email: string) {
    if (await this.repos.users.existsByEmail(email)) {
      throw ValidationError.withMessage("email", uniqueMessage("email"));
    }
  }

  // Creates (or refreshes) the invitation and emails the link
  async send({ name, email, companyId, companyName, role, template }: SendInvitationInput) {
    const inviteCode = randomString(6);
    await this.repos.invitations.upsertByEmail({ name, email, inviteCode, companyId, role });

    const inviteLink = `${this.frontendUrl}/invite/${inviteCode}`;
    try {
      await this.mailer.send({
        to: email,
        ...template({ name, company: companyName, inviteLink }),
      });
    } catch {
      throw new ForbiddenError("Failed to send invitation email. Please check mail configuration.");
    }
  }

  async register(code: string, input: RegisterInput) {
    const passwordHash = await this.hasher.make(input.password);

    await this.uow.run(async (repos) => {
      const invitation = await repos.invitations.findByCode(code);
      if (!invitation) throw new BadRequestError("Invitation not exists");

      // The account is created for the invited address, not whatever was posted
      if (await repos.users.existsByEmail(invitation.email)) {
        throw ValidationError.withMessage("email", uniqueMessage("email"));
      }

      let companyId = invitation.companyId;

      // Invited by the platform owner: the client gets a new company
      if (invitation.company.isGlobal) {
        if (!input.company_name) {
          throw ValidationError.withMessage("company_name", "The company name field is required.");
        }
        const company = await repos.companies.create({
          name: input.company_name,
          email: invitation.email,
        });
        companyId = company.id;
      }

      await repos.users.create({
        companyId,
        name: input.name,
        email: invitation.email,
        password: passwordHash,
        status: "enabled",
        type: invitation.role,
      });

      await repos.companies.update(companyId, {
        totalUsers: await repos.users.countByCompany(companyId),
      });
      await repos.invitations.clearCode(invitation.id);
    });
  }
}
