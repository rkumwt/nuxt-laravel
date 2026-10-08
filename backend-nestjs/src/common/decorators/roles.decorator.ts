import { Reflector } from '@nestjs/core';
import type { UserType } from '../../modules/users/user-type.enum.js';

// @Roles([UserType.Admin]) — FormRequest::authorize() as metadata
export const Roles = Reflector.createDecorator<UserType[]>();
