import { Body, Controller, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  CurrentToken,
  CurrentUser,
} from '../../common/decorators/current-user.decorator.js';
import { PostAction } from '../../common/decorators/post-action.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import type { User } from '../users/entities/user.entity.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import type { PersonalAccessToken } from './entities/personal-access-token.entity.js';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @PostAction('login', 'Login successful')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @PostAction('user', 'User Fetched successfully')
  async user(@CurrentUser() user: User) {
    return { user: await this.auth.profile(user.id) };
  }

  @PostAction('logout', 'Logged out successfully')
  async logout(@CurrentToken() token: PersonalAccessToken) {
    await this.auth.logout(token.id);
  }
}
