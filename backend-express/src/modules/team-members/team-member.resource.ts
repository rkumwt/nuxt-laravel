import type { User } from "../../generated/prisma/client.js";

export const toTeamMemberResource = (user: User) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  type: user.type,
  total_urls: user.totalUrls,
  total_url_hits: user.totalUrlHits,
});
