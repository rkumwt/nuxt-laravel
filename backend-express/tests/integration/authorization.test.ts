import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, bearer, login, prisma, seedFixtures } from "../helpers.js";

describe("role authorization", () => {
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    await seedFixtures();
    for (const role of ["superadmin", "admin", "member"]) {
      tokens[role] = await login(`${role}@example.com`);
    }
  });
  afterAll(() => prisma.$disconnect());

  it.each([
    ["admin", "/api/superadmin/clients"],
    ["member", "/api/superadmin/urls"],
    ["member", "/api/admin/team-members"],
    ["superadmin", "/api/admin/urls"],
    ["superadmin", "/api/admin/team-members/invite"],
  ])("%s cannot access %s", async (role, path) => {
    const res = await api().post(path).set(bearer(tokens[role]!));

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("This action is unauthorized.");
  });

  it.each([
    ["superadmin", "/api/superadmin/clients"],
    ["admin", "/api/admin/team-members"],
    ["admin", "/api/admin/urls"],
    ["member", "/api/admin/urls"],
  ])("%s can access %s", async (role, path) => {
    await api().post(path).set(bearer(tokens[role]!)).expect(200);
  });

  it("checks authentication before authorization", async () => {
    await api().post("/api/superadmin/clients").expect(401);
  });
});
