import { faker } from '@faker-js/faker';
import { randomString } from '../../common/utils/random.js';
import type { Company } from '../../modules/companies/entities/company.entity.js';
import type { ShortUrl } from '../../modules/short-urls/entities/short-url.entity.js';
import type { User } from '../../modules/users/entities/user.entity.js';

// database/factories/*.php — plain functions returning row data

const usedUserEmails = new Set<string>();
const usedCodes = new Set<string>();

const unique = <T>(used: Set<T>, make: () => T) => {
  let value = make();
  while (used.has(value)) value = make();
  used.add(value);
  return value;
};

export const companyFactory = (): Partial<Company> => ({
  name: faker.company.name(),
  email: faker.internet
    .email({ provider: faker.internet.domainName() })
    .toLowerCase(),
  totalUsers: faker.number.int({ min: 1, max: 50 }),
  totalUrls: faker.number.int({ min: 0, max: 500 }),
  totalUrlHits: faker.number.int({ min: 0, max: 10_000 }),
  isGlobal: false,
});

export const userFactory = (
  overrides: Partial<User> & Pick<User, 'companyId'>,
): Partial<User> => ({
  name: faker.person.fullName(),
  email: unique(usedUserEmails, () =>
    faker.internet.exampleEmail().toLowerCase(),
  ),
  ...overrides,
});

export const shortUrlFactory = (
  overrides: Pick<ShortUrl, 'companyId' | 'createdBy'>,
): Partial<ShortUrl> => ({
  url: `${faker.internet.url({ appendSlash: false })}/${faker.lorem.slug()}.html`,
  shortUrlCode: unique(usedCodes, () => randomString(6)),
  hits: faker.number.int({ min: 0, max: 1000 }),
  createdAt: faker.date.recent({ days: 30 }),
  updatedAt: faker.date.recent({ days: 30 }),
  ...overrides,
});
