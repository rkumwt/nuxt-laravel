import type { Company } from "../../generated/prisma/client.js";

export const toClientResource = (company: Company) => ({
  id: company.id,
  name: company.name,
  email: company.email,
  total_users: company.totalUsers,
  total_urls: company.totalUrls,
  total_url_hits: company.totalUrlHits,
});
