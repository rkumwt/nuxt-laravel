import { faker } from "@faker-js/faker";
import { config } from "../src/config/env.js";
import { PasswordHasher } from "../src/lib/hash.js";
import { prisma } from "../src/lib/prisma.js";
import { companyFactory, shortUrlFactory, userFactory } from "./factories.js";

// Port of database/seeders: CompanySeeder, ClientSeeder, ShortUrlsSeeder.
// Demo data is skipped in production (Laravel seeded it when APP_ENV=local).
const withDemoData = !config.isProduction;
const PASSWORD = "12345678";

async function truncate() {
  await prisma.$executeRaw`TRUNCATE personal_access_tokens, short_urls, invitations, users, companies RESTART IDENTITY CASCADE`;
}

// CompanySeeder
async function seedCompanies() {
  await prisma.company.create({
    data: { name: "Sembark", email: "gloablcompany@example.com", isGlobal: true },
  });

  if (withDemoData) {
    await prisma.company.create({ data: { name: "Demo Company", email: "company@example.com" } });
    await prisma.company.createMany({ data: Array.from({ length: 200 }, companyFactory) });
  }
}

// ClientSeeder
async function seedUsers(password: string) {
  const globalCompany = await prisma.company.findFirstOrThrow({ where: { isGlobal: true } });

  await prisma.user.create({
    data: {
      companyId: globalCompany.id,
      name: "Sembark",
      email: "superadmin@example.com",
      password,
      type: "superadmin",
      status: "enabled",
    },
  });

  if (!withDemoData) return;

  const demo = await prisma.company.findFirstOrThrow({ where: { email: "company@example.com" } });
  await prisma.user.createMany({
    data: [
      {
        companyId: demo.id,
        name: "Admin",
        email: "admin@example.com",
        password,
        status: "enabled",
      },
      {
        companyId: demo.id,
        name: "Member",
        email: "member@example.com",
        password,
        status: "enabled",
        type: "member",
      },
    ],
  });

  const companies = await prisma.company.findMany({
    where: { isGlobal: false },
    select: { id: true },
  });
  const users = companies.flatMap(({ id: companyId }) => [
    userFactory({ companyId, password, status: "enabled", type: "admin" }),
    ...Array.from({ length: faker.number.int({ min: 2, max: 5 }) }, () =>
      userFactory({
        companyId,
        password,
        status: "enabled",
        type: faker.helpers.arrayElement(["admin", "member"] as const),
      }),
    ),
  ]);
  await prisma.user.createMany({ data: users });
}

// ShortUrlsSeeder
async function seedShortUrls() {
  const demo = await prisma.company.findFirstOrThrow({ where: { email: "company@example.com" } });
  const member = await prisma.user.findUniqueOrThrow({ where: { email: "member@example.com" } });

  const randomUsers = async (companyId: number, limit: number) => {
    const users = await prisma.user.findMany({ where: { companyId }, select: { id: true } });
    return faker.helpers.shuffle(users).slice(0, limit);
  };

  const urls = [
    ...(await randomUsers(demo.id, 5)).flatMap(({ id }) =>
      Array.from({ length: 50 }, () => shortUrlFactory({ companyId: demo.id, createdBy: id })),
    ),
    ...Array.from({ length: 35 }, () =>
      shortUrlFactory({ companyId: demo.id, createdBy: member.id }),
    ),
  ];

  const others = await prisma.company.findMany({
    where: { isGlobal: false, id: { not: demo.id } },
    select: { id: true },
  });
  for (const { id: companyId } of faker.helpers.arrayElements(others, { min: 5, max: 15 })) {
    for (const { id } of await randomUsers(companyId, 5)) {
      urls.push(...Array.from({ length: 50 }, () => shortUrlFactory({ companyId, createdBy: id })));
    }
  }

  await prisma.shortUrl.createMany({ data: urls });
  return urls.length;
}

// Recalculate the denormalized counters in two set-based queries
async function updateTotals() {
  await prisma.$executeRaw`
    UPDATE companies c SET
      total_urls     = COALESCE(s.urls, 0),
      total_url_hits = COALESCE(s.hits, 0),
      total_users    = (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id)
    FROM companies c2
    LEFT JOIN (SELECT company_id, COUNT(*) AS urls, SUM(hits) AS hits FROM short_urls GROUP BY company_id) s
      ON s.company_id = c2.id
    WHERE c.id = c2.id AND c.is_global = false`;

  await prisma.$executeRaw`
    UPDATE users u SET
      total_urls     = COALESCE(s.urls, 0),
      total_url_hits = COALESCE(s.hits, 0)
    FROM users u2
    LEFT JOIN (SELECT created_by, COUNT(*) AS urls, SUM(hits) AS hits FROM short_urls GROUP BY created_by) s
      ON s.created_by = u2.id
    WHERE u.id = u2.id`;
}

async function main() {
  const password = await new PasswordHasher(config.auth.bcryptRounds).make(PASSWORD);

  await truncate();
  await seedCompanies();
  await seedUsers(password);

  if (withDemoData) {
    const count = await seedShortUrls();
    await updateTotals();
    console.log(`Seeded demo data (${count} short URLs).`);
  }

  console.log(`Superadmin: superadmin@example.com / ${PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
