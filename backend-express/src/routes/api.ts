import { Router } from "express";
import type { Container } from "../container.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { loginRateLimiter } from "../middlewares/rate-limit.js";
import { authRoutes } from "../modules/auth/auth.routes.js";
import { clientRoutes } from "../modules/clients/client.routes.js";
import { invitationRoutes } from "../modules/invitations/invitation.routes.js";
import {
  companyShortUrlRoutes,
  superadminShortUrlRoutes,
} from "../modules/short-urls/short-url.routes.js";
import { teamMemberRoutes } from "../modules/team-members/team-member.routes.js";

// routes/api.php
export const apiRoutes = ({ controllers, accessTokens, config }: Container) => {
  const auth = authenticate(accessTokens);
  const loginLimiter = loginRateLimiter({ limit: 10, skip: config.isTest });

  return Router()
    .use(authRoutes(controllers.auth, { authenticate: auth, loginLimiter }))
    .use(invitationRoutes(controllers.invitations))
    .use(
      "/superadmin",
      auth,
      authorize("superadmin"),
      clientRoutes(controllers.clients),
      superadminShortUrlRoutes(controllers.shortUrls),
    )
    .use(
      "/admin",
      auth,
      teamMemberRoutes(controllers.teamMembers),
      companyShortUrlRoutes(controllers.shortUrls),
    );
};
