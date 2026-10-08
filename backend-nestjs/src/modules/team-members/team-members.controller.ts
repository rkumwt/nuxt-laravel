import { Body, Controller } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { PostAction } from '../../common/decorators/post-action.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { toPageRequest } from '../../common/utils/pagination.js';
import { TeamMemberInviteDto } from '../invitations/dto/invite.dto.js';
import type { User } from '../users/entities/user.entity.js';
import { UserType } from '../users/user-type.enum.js';
import { TeamMembersService } from './team-members.service.js';

@Roles([UserType.Admin])
@Controller('admin/team-members')
export class TeamMembersController {
  constructor(private readonly teamMembers: TeamMembersService) {}

  @PostAction('invite', 'Invitation send successfully')
  async invite(@CurrentUser() user: User, @Body() dto: TeamMemberInviteDto) {
    await this.teamMembers.invite(user, dto);
  }

  @PostAction('', 'Team members fetched successfully')
  index(@CurrentUser() user: User, @Body() dto: PaginationDto) {
    return this.teamMembers.list(user, toPageRequest(dto));
  }
}
