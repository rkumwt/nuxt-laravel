import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { api, bearer, login, mailer, prisma, seedFixtures } from "../helpers.js";

const register = (code: string, body: Record<string, string>) =>
  api()
    .post(`/api/invitation/${code}/register`)
    .send({
      name: "New Person",
      email: "ignored@example.com",
      password: "password1",
      password_confirmation: "password1",
      ...body,
    });

describe("invitations", () => {
  beforeEach(seedFixtures);
  afterAll(() => prisma.$disconnect());

  it("superadmin invites a client who signs up with a new company", async () => {
    const token = await login("superadmin@example.com");
    await api()
      .post("/api/superadmin/clients/invite")
      .set(bearer(token))
      .send({ name: "Client", email: "client@new.test" })
      .expect(200);

    expect(mailer.sent.at(-1)).toMatchObject({
      to: "client@new.test",
      subject: "Invitation mail from Sembark",
    });
    const code = mailer.lastInviteCode()!;

    const info = await api().post(`/api/invitation/${code}`);
    expect(info.body.data.data).toMatchObject({
      email: "client@new.test",
      company: { name: "Sembark", is_global: 1 },
    });

    const missingCompany = await register(code, {});
    expect(missingCompany.status).toBe(422);
    expect(missingCompany.body.errors).toEqual({
      company_name: ["The company name field is required."],
    });

    await register(code, { company_name: "Fresh Co" }).expect(200);

    // The account uses the invited address, not the posted one
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "client@new.test" },
      include: { company: true },
    });
    expect(user).toMatchObject({
      type: "admin",
      status: "enabled",
      company: { name: "Fresh Co", isGlobal: false },
    });

    // Codes are single-use
    const reused = await api().post(`/api/invitation/${code}`);
    expect(reused.status).toBe(400);
  });

  it("admin invites a team member into their own company with a role", async () => {
    const token = await login("admin@example.com");
    await api()
      .post("/api/admin/team-members/invite")
      .set(bearer(token))
      .send({ name: "Teammate", email: "mate@new.test", role: "member" })
      .expect(200);

    expect(mailer.sent.at(-1)?.subject).toBe("Invitation from Demo Company");
    await register(mailer.lastInviteCode()!, {}).expect(200);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "mate@new.test" },
      include: { company: true },
    });
    expect(user).toMatchObject({ type: "member", company: { name: "Demo Company" } });
    expect(user.company.totalUsers).toBe(3);
  });

  it("rejects emails that already have an account", async () => {
    const token = await login("superadmin@example.com");
    const res = await api()
      .post("/api/superadmin/clients/invite")
      .set(bearer(token))
      .send({ name: "Dup", email: "admin@example.com" });

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual({ email: ["The email has already been taken."] });
  });

  it("reports mail failures with 403 like the Laravel app", async () => {
    const token = await login("superadmin@example.com");
    mailer.failNext = true;

    const res = await api()
      .post("/api/superadmin/clients/invite")
      .set(bearer(token))
      .send({ name: "Client", email: "client2@new.test" });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe(
      "Failed to send invitation email. Please check mail configuration.",
    );
  });

  it("returns every registration error at once", async () => {
    const res = await api()
      .post("/api/invitation/whatever/register")
      .send({ password: "short", password_confirmation: "different" });

    expect(res.status).toBe(422);
    expect(Object.keys(res.body.errors)).toEqual([
      "name",
      "email",
      "password",
      "password_confirmation",
    ]);
  });
});
