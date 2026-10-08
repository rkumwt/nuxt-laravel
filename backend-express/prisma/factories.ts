import { faker } from "@faker-js/faker";
import type { Prisma } from "../src/generated/prisma/client.js";
import { randomString } from "../src/utils/random.js";

// database/factories/*.php — plain functions that return row data

const usedUserEmails = new Set<string>();
const usedCodes = new Set<string>();

const unique = <T>(used: Set<T>, make: () => T) => {
  let value = make();
  while (used.has(value)) value = make();
  used.add(value);
  return value;
};

export const companyFactory = (): Prisma.CompanyCreateManyInput => ({
  name: faker.company.name(),
  email: faker.internet.email({ provider: faker.internet.domainName() }).toLowerCase(),
  totalUsers: faker.number.int({ min: 1, max: 50 }),
  totalUrls: faker.number.int({ min: 0, max: 500 }),
  totalUrlHits: faker.number.int({ min: 0, max: 10_000 }),
  isGlobal: false,
});

export const userFactory = (
  overrides: Pick<Prisma.UserCreateManyInput, "companyId" | "password"> &
    Partial<Prisma.UserCreateManyInput>,
): Prisma.UserCreateManyInput => ({
  name: faker.person.fullName(),
  email: unique(usedUserEmails, () => faker.internet.exampleEmail().toLowerCase()),
  ...overrides,
});

export const shortUrlFactory = (
  overrides: Pick<Prisma.ShortUrlCreateManyInput, "companyId" | "createdBy">,
): Prisma.ShortUrlCreateManyInput => ({
  url: `${faker.internet.url({ appendSlash: false })}/${faker.lorem.slug()}.html`,
  shortUrlCode: unique(usedCodes, () => randomString(6)),
  hits: faker.number.int({ min: 0, max: 1000 }),
  createdAt: faker.date.recent({ days: 30 }),
  updatedAt: faker.date.recent({ days: 30 }),
  ...overrides,
});
