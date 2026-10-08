import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import type { DataSource } from 'typeorm';
import { Company } from '../../modules/companies/entities/company.entity.js';
import { ShortUrl } from '../../modules/short-urls/entities/short-url.entity.js';
import { User } from '../../modules/users/entities/user.entity.js';
import { UserStatus, UserType } from '../../modules/users/user-type.enum.js';
import dataSource from '../data-source.js';
import { companyFactory, shortUrlFactory, userFactory } from './factories.js';

// Port of database/seeders: CompanySeeder, ClientSeeder, ShortUrlsSeeder.
// Demo data is skipped in production (Laravel seeded it when APP_ENV=local).
const withDemoData = process.env.NODE_ENV !== 'production';
const PASSWORD = '12345678';

// Postgres limits bind parameters per statement, so insert in chunks
async function insertChunked<T extends object>(
  db: DataSource,
  entity: new () => T,
  rows: Partial<T>[],
) {
  for (let i = 0; i < rows.length; i += 1000) {
    await db.getRepository(entity).insert(rows.slice(i, i + 1000) as never);
  }
}

async function truncate(db: DataSource) {
  await db.query(
    'TRUNCATE personal_access_tokens, short_urls, invitations, users, companies RESTART IDENTITY CASCADE',
  );
}

// CompanySeeder
async function seedCompanies(db: DataSource) {
  const companies = db.getRepository(Company);
  await companies.insert({
    name: 'Sembark',
    email: 'gloablcompany@example.com',
    isGlobal: true,
  });

  if (withDemoData) {
    await companies.insert({
      name: 'Demo Company',
      email: 'company@example.com',
    });
    await insertChunked(
      db,
      Company,
      Array.from({ length: 200 }, companyFactory),
    );
  }
}

// ClientSeeder
async function seedUsers(db: DataSource, password: string) {
  const companies = db.getRepository(Company);
  const users = db.getRepository(User);
  const global = await companies.findOneByOrFail({ isGlobal: true });

  await users.insert({
    companyId: global.id,
    name: 'Sembark',
    email: 'superadmin@example.com',
    password,
    type: UserType.Superadmin,
    status: UserStatus.Enabled,
  });

  if (!withDemoData) return;

  const demo = await companies.findOneByOrFail({
    email: 'company@example.com',
  });
  await users.insert([
    {
      companyId: demo.id,
      name: 'Admin',
      email: 'admin@example.com',
      password,
      status: UserStatus.Enabled,
    },
    {
      companyId: demo.id,
      name: 'Member',
      email: 'member@example.com',
      password,
      status: UserStatus.Enabled,
      type: UserType.Member,
    },
  ]);

  const clients = await companies.find({
    where: { isGlobal: false },
    select: { id: true },
  });
  const rows = clients.flatMap(({ id: companyId }) => [
    userFactory({
      companyId,
      password,
      status: UserStatus.Enabled,
      type: UserType.Admin,
    }),
    ...Array.from({ length: faker.number.int({ min: 2, max: 5 }) }, () =>
      userFactory({
        companyId,
        password,
        status: UserStatus.Enabled,
        type: faker.helpers.arrayElement([UserType.Admin, UserType.Member]),
      }),
    ),
  ]);
  await insertChunked(db, User, rows);
}

// ShortUrlsSeeder
async function seedShortUrls(db: DataSource) {
  const companies = db.getRepository(Company);
  const users = db.getRepository(User);
  const demo = await companies.findOneByOrFail({
    email: 'company@example.com',
  });
  const member = await users.findOneByOrFail({ email: 'member@example.com' });

  const randomUsers = async (companyId: number, limit: number) => {
    const all = await users.find({
      where: { companyId },
      select: { id: true },
    });
    return faker.helpers.shuffle(all).slice(0, limit);
  };

  const urls = [
    ...(await randomUsers(demo.id, 5)).flatMap(({ id }) =>
      Array.from({ length: 50 }, () =>
        shortUrlFactory({ companyId: demo.id, createdBy: id }),
      ),
    ),
    ...Array.from({ length: 35 }, () =>
      shortUrlFactory({ companyId: demo.id, createdBy: member.id }),
    ),
  ];

  const others = await companies
    .createQueryBuilder('c')
    .select('c.id')
    .where('c.isGlobal = false AND c.id <> :demo', { demo: demo.id })
    .getMany();
  for (const { id: companyId } of faker.helpers.arrayElements(others, {
    min: 5,
    max: 15,
  })) {
    for (const { id } of await randomUsers(companyId, 5)) {
      urls.push(
        ...Array.from({ length: 50 }, () =>
          shortUrlFactory({ companyId, createdBy: id }),
        ),
      );
    }
  }

  await insertChunked(db, ShortUrl, urls);
  return urls.length;
}

// Recalculate the denormalized counters in two set-based queries
async function updateTotals(db: DataSource) {
  await db.query(`
    UPDATE companies c SET
      total_urls     = COALESCE(s.urls, 0),
      total_url_hits = COALESCE(s.hits, 0),
      total_users    = (SELECT COUNT(*) FROM users u WHERE u.company_id = c.id)
    FROM companies c2
    LEFT JOIN (SELECT company_id, COUNT(*) AS urls, SUM(hits) AS hits FROM short_urls GROUP BY company_id) s
      ON s.company_id = c2.id
    WHERE c.id = c2.id AND c.is_global = false`);

  await db.query(`
    UPDATE users u SET
      total_urls     = COALESCE(s.urls, 0),
      total_url_hits = COALESCE(s.hits, 0)
    FROM users u2
    LEFT JOIN (SELECT created_by, COUNT(*) AS urls, SUM(hits) AS hits FROM short_urls GROUP BY created_by) s
      ON s.created_by = u2.id
    WHERE u.id = u2.id`);
}

async function main() {
  const db = await dataSource.initialize();
  try {
    const password = await bcrypt.hash(
      PASSWORD,
      Number(process.env.BCRYPT_ROUNDS ?? 12),
    );

    await truncate(db);
    await seedCompanies(db);
    await seedUsers(db, password);

    if (withDemoData) {
      const count = await seedShortUrls(db);
      await updateTotals(db);
      console.log(`Seeded demo data (${count} short URLs).`);
    }
    console.log(`Superadmin: superadmin@example.com / ${PASSWORD}`);
  } finally {
    await db.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
