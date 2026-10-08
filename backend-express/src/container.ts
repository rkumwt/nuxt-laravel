import type { AppConfig } from "./config/env.js";
import { createRepositories, UnitOfWork } from "./database/unit-of-work.js";
import type { PrismaClient } from "./generated/prisma/client.js";
import { PasswordHasher } from "./lib/hash.js";
import type { Logger } from "./lib/logger.js";
import { createMailer, type Mailer } from "./mail/mailer.js";
import { AccessTokenService } from "./modules/auth/access-token.service.js";
import { AuthController } from "./modules/auth/auth.controller.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { ClientController } from "./modules/clients/client.controller.js";
import { ClientService } from "./modules/clients/client.service.js";
import { InvitationController } from "./modules/invitations/invitation.controller.js";
import { InvitationService } from "./modules/invitations/invitation.service.js";
import { RedirectController } from "./modules/short-urls/redirect.controller.js";
import { ShortUrlController } from "./modules/short-urls/short-url.controller.js";
import { ShortUrlService } from "./modules/short-urls/short-url.service.js";
import { TeamMemberController } from "./modules/team-members/team-member.controller.js";
import { TeamMemberService } from "./modules/team-members/team-member.service.js";

export interface ContainerDeps {
  config: AppConfig;
  prisma: PrismaClient;
  logger: Logger;
  // Tests pass a fake to capture emails
  mailer?: Mailer;
}

// Composition root (Laravel's service container): the only place that knows
// how classes are wired together. Everything else receives its dependencies.
export const createContainer = ({ config, prisma, logger, mailer }: ContainerDeps) => {
  const repos = createRepositories(prisma);
  const uow = new UnitOfWork(prisma);
  const hasher = new PasswordHasher(config.auth.bcryptRounds);
  const accessTokens = new AccessTokenService(
    repos.accessTokens,
    config.auth.tokenExpirationMinutes,
  );

  const invitationService = new InvitationService(
    repos,
    uow,
    hasher,
    mailer ?? createMailer(config.mail, logger),
    config.frontendUrl,
  );
  const shortUrlService = new ShortUrlService(repos, uow, config.appUrl);

  return {
    config,
    prisma,
    logger,
    accessTokens,
    controllers: {
      auth: new AuthController(new AuthService(repos, hasher, accessTokens)),
      invitations: new InvitationController(invitationService),
      clients: new ClientController(new ClientService(repos, invitationService)),
      teamMembers: new TeamMemberController(new TeamMemberService(repos, invitationService)),
      shortUrls: new ShortUrlController(shortUrlService),
      redirect: new RedirectController(shortUrlService),
    },
  };
};

export type Container = ReturnType<typeof createContainer>;
