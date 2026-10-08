import {
  Required,
  RequiredEmail,
  RequiredIn,
} from '../../../common/validation/rules.js';
import { IsUnique } from '../../../common/validation/is-unique.validator.js';
import { User } from '../../users/entities/user.entity.js';
import { UserType } from '../../users/user-type.enum.js';

// ClientsInviteRequest: name required, email required|email|unique:users,email
export class InviteDto {
  @Required('name')
  name: string;

  @IsUnique(User, 'email')
  @RequiredEmail('email')
  email: string;
}

// TeamMembersInviteRequest: + role required|in:admin,member
export class TeamMemberInviteDto extends InviteDto {
  @RequiredIn('role', [UserType.Admin, UserType.Member])
  role: UserType.Admin | UserType.Member;
}
