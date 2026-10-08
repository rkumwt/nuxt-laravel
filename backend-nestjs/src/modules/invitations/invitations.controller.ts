import { Body, Controller, Param } from '@nestjs/common';
import { PostAction } from '../../common/decorators/post-action.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { RegisterDto } from './dto/register.dto.js';
import { InvitationsService } from './invitations.service.js';

@Public()
@Controller('invitation')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @PostAction(
    ':code/register',
    'Registration completed successfully. Now you can login.',
  )
  async register(@Param('code') code: string, @Body() dto: RegisterDto) {
    await this.invitations.register(code, dto);
  }

  @PostAction(':code', 'Information fetched successfully')
  async show(@Param('code') code: string) {
    return { data: await this.invitations.findByCode(code) };
  }
}
