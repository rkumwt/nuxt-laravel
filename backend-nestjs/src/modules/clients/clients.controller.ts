import { Body, Controller } from '@nestjs/common';
import { PostAction } from '../../common/decorators/post-action.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { toPageRequest } from '../../common/utils/pagination.js';
import { InviteDto } from '../invitations/dto/invite.dto.js';
import { UserType } from '../users/user-type.enum.js';
import { ClientsService } from './clients.service.js';

@Roles([UserType.Superadmin])
@Controller('superadmin/clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @PostAction('invite', 'Invitation send successfully')
  async invite(@Body() dto: InviteDto) {
    await this.clients.invite(dto);
  }

  @PostAction('', 'Clients fetched successfully')
  index(@Body() dto: PaginationDto) {
    return this.clients.list(toPageRequest(dto));
  }
}
