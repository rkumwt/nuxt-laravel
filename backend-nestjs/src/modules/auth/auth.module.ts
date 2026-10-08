import { Module } from '@nestjs/common';
import { AccessTokenService } from './access-token.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordHasher } from './password-hasher.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AccessTokenService, PasswordHasher],
  exports: [AccessTokenService, PasswordHasher],
})
export class AuthModule {}
