import { Module } from '@nestjs/common';
import { InvitationsModule } from '../invitations/invitations.module.js';
import { TeamMembersController } from './team-members.controller.js';
import { TeamMembersService } from './team-members.service.js';

@Module({
  imports: [InvitationsModule],
  controllers: [TeamMembersController],
  providers: [TeamMembersService],
})
export class TeamMembersModule {}
