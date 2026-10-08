import type { Invitation } from "../../generated/prisma/client.js";

type InvitationWithCompany = Invitation & {
  company: { id: number; name: string; isGlobal: boolean };
};

export const toInvitationResource = (invitation: InvitationWithCompany) => ({
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
