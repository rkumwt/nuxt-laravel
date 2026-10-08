import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import {
  MAILER,
  type Mailer,
  type MailMessage,
} from '../src/modules/mail/mailer.js';
import { Company } from '../src/modules/companies/entities/company.entity.js';
import { User } from '../src/modules/users/entities/user.entity.js';
import { UserStatus, UserType } from '../src/modules/users/user-type.enum.js';

export const PASSWORD = '12345678';

// Mail::fake(): records messages, can be told to fail once
export class FakeMailer implements Mailer {
  sent: MailMessage[] = [];
  failNext = false;

  async send(message: MailMessage) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('SMTP down');
    }
    this.sent.push(message);
  }

  lastInviteCode() {
    return this.sent.at(-1)?.html.match(/\/invite\/([A-Za-z0-9]+)/)?.[1];
  }
}

export async function createTestApp() {
  const mailer = new FakeMailer();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MAILER)
    .useValue(mailer)
    .compile();

  const app = configureApp(
    moduleRef.createNestApplication<NestExpressApplication>({ logger: false }),
  );
  await app.init();

  const dataSource = app.get(DataSource);
  const api = () => request(app.getHttpServer());

  const login = async (email: string) => {
    const res = await api()
      .post('/api/login')
      .send({ email, password: PASSWORD });
    return res.body.data.token as string;
  };

  // Minimal fixtures: platform company + superadmin, a client with an admin and a member
  const seedFixtures = async () => {
    await dataSource.query(
      'TRUNCATE personal_access_tokens, short_urls, invitations, users, companies RESTART IDENTITY CASCADE',
    );
    mailer.sent = [];
    const password = await bcrypt.hash(PASSWORD, 4);
    const companies = dataSource.getRepository(Company);
    const users = dataSource.getRepository(User);

    const platform = await companies.save({
      name: 'Sembark',
      email: 'global@example.com',
      isGlobal: true,
    });
    const client = await companies.save({
      name: 'Demo Company',
      email: 'company@example.com',
    });
    const other = await companies.save({
      name: 'Other Co',
      email: 'other@example.com',
    });

    const make = (
      companyId: number,
      name: string,
      email: string,
      type: UserType,
    ) =>
      users.save({
        companyId,
        name,
        email,
        password,
        type,
        status: UserStatus.Enabled,
      });

    return {
      platform,
      client,
      other,
      superadmin: await make(
        platform.id,
        'Super',
        'superadmin@example.com',
        UserType.Superadmin,
      ),
      admin: await make(
        client.id,
        'Admin',
        'admin@example.com',
        UserType.Admin,
      ),
      member: await make(
        client.id,
        'Member',
        'member@example.com',
        UserType.Member,
      ),
      outsider: await make(
        other.id,
        'Outsider',
        'outsider@example.com',
        UserType.Admin,
      ),
    };
  };

  return { app, api, dataSource, mailer, login, seedFixtures };
}

export type TestApp = Awaited<ReturnType<typeof createTestApp>>;
export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
