import type { UserWithCompany } from "../../database/repositories/user.repository.js";

// Fields the Laravel app selected for the logged-in user
export const toAuthUserResource = (user: UserWithCompany) => ({
  id: user.id,
  name: user.name,
  type: user.type,
  status: user.status,
  company_id: user.companyId,
  company: { id: user.company.id, name: user.company.name },
});
