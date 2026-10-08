import request from "supertest";
import { createApp } from "../src/app.js";
import { config } from "../src/config/env.js";
import { createContainer } from "../src/container.js";
import { PasswordHasher } from "../src/lib/hash.js";
import { logger } from "../src/lib/logger.js";
import { prisma } from "../src/lib/prisma.js";
import type { Mailer, MailMessage } from "../src/mail/mailer.js";

export const PASSWORD = "12345678";

// Captures emails instead of sending them; can be told to fail
export class FakeMailer implements Mailer {
  sent: MailMessage[] = [];
  failNext = false;

  async send(message: MailMessage) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("SMTP down");
    }
    this.sent.push(message);
  }

  lastInviteCode() {
    const html = this.sent.at(-1)?.html ?? "";
    return html.match(/\/invite\/([A-Za-z0-9]+)/)?.[1];
  }
}

export const mailer = new FakeMailer();
export const app = createApp(createContainer({ config, prisma, logger, mailer }));
export const api = () => request(app);

export const resetDatabase = () =>
  prisma.$executeRaw`TRUNCATE personal_access_tokens, short_urls, invitations, users, companies RESTART IDENTITY CASCADE`;

// Minimal fixtures: platform company + superadmin, one client with an admin and a member
export async function seedFixtures() {
  await resetDatabase();
  mailer.sent = [];
  const password = await new PasswordHasher(4).make(PASSWORD);

  const platform = await prisma.company.create({
    data: { name: "Sembark", email: "global@example.com", isGlobal: true },
  });
  const client = await prisma.company.create({
    data: { name: "Demo Company", email: "company@example.com" },
  });
  const other = await prisma.company.create({
    data: { name: "Other Co", email: "other@example.com" },
  });

  const superadmin = await prisma.user.create({
    data: {
      companyId: platform.id,
      name: "Super",
      email: "superadmin@example.com",
      password,
      type: "superadmin",
      status: "enabled",
    },
  });
  const admin = await prisma.user.create({
    data: {
      companyId: client.id,
      name: "Admin",
      email: "admin@example.com",
      password,
      type: "admin",
      status: "enabled",
    },
  });
  const member = await prisma.user.create({
    data: {
      companyId: client.id,
      name: "Member",
      email: "member@example.com",
      password,
      type: "member",
      status: "enabled",
    },
  });
  const outsider = await prisma.user.create({
    data: {
      companyId: other.id,
      name: "Outsider",
      email: "outsider@example.com",
      password,
      type: "admin",
      status: "enabled",
    },
  });

  return { platform, client, other, superadmin, admin, member, outsider };
}

export async function login(email: string) {
  const res = await api().post("/api/login").send({ email, password: PASSWORD });
  return res.body.data.token as string;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export { prisma };
