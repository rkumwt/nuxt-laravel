import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { paginated, type PageRequest } from '../../common/utils/pagination.js';
import { CompaniesRepository } from '../../database/repositories/companies.repository.js';
import type { InviteDto } from '../invitations/dto/invite.dto.js';
import { InvitationsService } from '../invitations/invitations.service.js';
import { inviteClientMail } from '../mail/templates/invitations.js';
import { UserType } from '../users/user-type.enum.js';
import { toClientResource } from './client.resource.js';

@Injectable()
export class ClientsService {
  constructor(
    private readonly companies: CompaniesRepository,
    private readonly invitations: InvitationsService,
  ) {}

  async list(page: PageRequest) {
    const { items, total } = await this.companies.paginateClients(page);
    return paginated(items.map(toClientResource), total, page);
  }

  // Clients are invited into the global company and get their own company on signup
  async invite({ name, email }: InviteDto) {
    const globalCompany = await this.companies.findGlobal();
    if (!globalCompany) {
      throw new InternalServerErrorException(
        'The global company has not been seeded.',
      );
    }

    await this.invitations.send({
      name,
      email,
      companyId: globalCompany.id,
      companyName: globalCompany.name,
      role: UserType.Admin,
      template: inviteClientMail,
    });
  }
}
