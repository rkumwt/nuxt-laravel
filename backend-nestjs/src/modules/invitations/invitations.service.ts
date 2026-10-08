import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { ValidationException } from '../../common/exceptions/validation.exception.js';
import { randomString } from '../../common/utils/random.js';
import { appConfig } from '../../config/app.config.js';
import { InvitationsRepository } from '../../database/repositories/invitations.repository.js';
import { UnitOfWork } from '../../database/unit-of-work.js';
import { PasswordHasher } from '../auth/password-hasher.service.js';
import { MAILER, type Mailer } from '../mail/mailer.js';
import type { InvitationTemplate } from '../mail/templates/invitations.js';
import { UserStatus, type UserType } from '../users/user-type.enum.js';
import type { RegisterDto } from './dto/register.dto.js';
import { toInvitationResource } from './invitation.resource.js';

export interface SendInvitationInput {
  name: string;
  email: string;
  companyId: number;
  companyName: string;
  role: UserType;
  template: InvitationTemplate;
}

const emailTaken = () =>
  ValidationException.withMessage('email', 'The email has already been taken.');

@Injectable()
export class InvitationsService {
  constructor(
    private readonly invitations: InvitationsRepository,
    private readonly uow: UnitOfWork,
    private readonly hasher: PasswordHasher,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
  ) {}

  async findByCode(code: string) {
    const invitation = await this.invitations.findByCode(code);
    if (!invitation)
      throw new BadRequestException('Invitation code not exists');
    return toInvitationResource(invitation);
  }

  // Creates (or refreshes) the invitation and emails the link
  async send({
    name,
    email,
    companyId,
    companyName,
    role,
    template,
  }: SendInvitationInput) {
    const inviteCode = randomString(6);
    await this.invitations.upsertByEmail({
      name,
      email,
      inviteCode,
      companyId,
      role,
    });

    const inviteLink = `${this.app.frontendUrl}/invite/${inviteCode}`;
    try {
      await this.mailer.send({
        to: email,
        ...template({ name, company: companyName, inviteLink }),
      });
    } catch {
      throw new ForbiddenException(
        'Failed to send invitation email. Please check mail configuration.',
      );
    }
  }

  async register(code: string, dto: RegisterDto) {
    const password = await this.hasher.make(dto.password);

    await this.uow.run(async (repos) => {
      const invitation = await repos.invitations.findByCode(code);
      if (!invitation) throw new BadRequestException('Invitation not exists');

      // The account is created for the invited address, not whatever was posted
      if (await repos.users.existsByEmail(invitation.email)) throw emailTaken();

      let companyId = invitation.companyId;

      // Invited by the platform owner: the client gets a new company
      if (invitation.company.isGlobal) {
        if (!dto.company_name) {
          throw ValidationException.withMessage(
            'company_name',
            'The company name field is required.',
          );
        }
        const company = await repos.companies.create({
          name: dto.company_name,
          email: invitation.email,
        });
        companyId = company.id;
      }

      await repos.users.create({
        companyId,
        name: dto.name,
        email: invitation.email,
        password,
        status: UserStatus.Enabled,
        type: invitation.role,
      });

      await repos.companies.updateTotals(companyId, {
        totalUsers: await repos.users.countByCompany(companyId),
      });
      await repos.invitations.clearCode(invitation.id);
    });
  }
}
