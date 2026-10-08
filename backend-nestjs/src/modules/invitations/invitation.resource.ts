import type { Invitation } from './entities/invitation.entity.js';

export const toInvitationResource = (invitation: Invitation) => ({
  name: invitation.name,
  email: invitation.email,
  company_id: invitation.companyId,
  company: {
    id: invitation.company.id,
    name: invitation.company.name,
    // Laravel cast is_global to an integer; both frontends test truthiness
    is_global: invitation.company.isGlobal ? 1 : 0,
  },
});
