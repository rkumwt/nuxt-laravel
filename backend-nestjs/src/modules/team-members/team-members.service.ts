import { Injectable, NotFoundException } from '@nestjs/common';
import { paginated, type PageRequest } from '../../common/utils/pagination.js';
import { UsersRepository } from '../../database/repositories/users.repository.js';
import type { TeamMemberInviteDto } from '../invitations/dto/invite.dto.js';
import { InvitationsService } from '../invitations/invitations.service.js';
import { inviteTeamMemberMail } from '../mail/templates/invitations.js';
import type { User } from '../users/entities/user.entity.js';
import { toTeamMemberResource } from './team-member.resource.js';

@Injectable()
export class TeamMembersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly invitations: InvitationsService,
  ) {}

  async list(admin: User, page: PageRequest) {
    const { items, total } = await this.users.paginateByCompany(
      admin.companyId,
      page,
    );
    return paginated(items.map(toTeamMemberResource), total, page);
  }

  async invite(admin: User, { name, email, role }: TeamMemberInviteDto) {
    const user = await this.users.findWithCompany(admin.id);
    if (!user) throw new NotFoundException();

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
