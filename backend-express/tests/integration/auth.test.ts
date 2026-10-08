import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { api, bearer, login, prisma, seedFixtures } from "../helpers.js";

describe("auth", () => {
  beforeEach(seedFixtures);
  afterAll(() => prisma.$disconnect());

  it("logs in and returns a Sanctum-style token with the user", async () => {
    const res = await api()
      .post("/api/login")
      .send({ email: "admin@example.com", password: "12345678" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: true,
      message: "Login successful",
      data: {
        user: {
          name: "Admin",
          type: "admin",
          status: "enabled",
          company: { name: "Demo Company" },
        },
      },
    });
    expect(res.body.data.token).toMatch(/^\d+\|[A-Za-z0-9]{40}$/);
    expect(res.body.data.user).not.toHaveProperty("password");
  });

  it("rejects wrong credentials with 403", async () => {
    const res = await api()
      .post("/api/login")
      .send({ email: "admin@example.com", password: "wrong-pass" });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ status: false, message: "Invalid credentials", errors: [] });
  });

  it("returns Laravel-style validation errors", async () => {
    const res = await api().post("/api/login").send({ email: "not-an-email", password: "  " });

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual({
      email: ["The email field must be a valid email address."],
      password: ["The password field is required."],
    });
  });

  it("returns the current user and revokes the token on logout", async () => {
    const token = await login("member@example.com");

    const me = await api().post("/api/user").set(bearer(token));
    expect(me.body.data.user).toMatchObject({ name: "Member", type: "member" });

    await api().post("/api/logout").set(bearer(token)).expect(200);

    const after = await api().post("/api/user").set(bearer(token));
    expect(after.status).toBe(401);
    expect(after.body.message).toBe("Unauthenticated");
  });

  it("rejects missing, malformed and forged tokens", async () => {
    const token = await login("admin@example.com");
    const [id] = token.split("|");

    await api().post("/api/user").expect(401);
    await api().post("/api/user").set({ Authorization: "Basic abc" }).expect(401);
    await api()
      .post("/api/user")
      .set(bearer(`${id}|${"x".repeat(40)}`))
      .expect(401);
  });
});
