import { Module } from '@nestjs/common';
import { InvitationsModule } from '../invitations/invitations.module.js';
import { ClientsController } from './clients.controller.js';
import { ClientsService } from './clients.service.js';

@Module({
  imports: [InvitationsModule],
  controllers: [ClientsController],
  providers: [ClientsService],
})
export class ClientsModule {}
