import { PersonalAccessToken } from '../modules/auth/entities/personal-access-token.entity.js';
import { Company } from '../modules/companies/entities/company.entity.js';
import { Invitation } from '../modules/invitations/entities/invitation.entity.js';
import { ShortUrl } from '../modules/short-urls/entities/short-url.entity.js';
import { User } from '../modules/users/entities/user.entity.js';

export const entities = [
  Company,
  User,
  ShortUrl,
  Invitation,
  PersonalAccessToken,
];
