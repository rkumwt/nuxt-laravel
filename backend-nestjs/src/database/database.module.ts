import { Global, Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IsUniqueConstraint } from '../common/validation/is-unique.validator.js';
import { databaseConfig } from '../config/database.config.js';
import { AccessTokensRepository } from './repositories/access-tokens.repository.js';
import { CompaniesRepository } from './repositories/companies.repository.js';
import { InvitationsRepository } from './repositories/invitations.repository.js';
import { ShortUrlsRepository } from './repositories/short-urls.repository.js';
import { UsersRepository } from './repositories/users.repository.js';
import { typeOrmOptions } from './typeorm.options.js';
import { UnitOfWork } from './unit-of-work.js';

const repositories = [
  AccessTokensRepository,
  CompaniesRepository,
  InvitationsRepository,
  ShortUrlsRepository,
  UsersRepository,
];

// Persistence layer shared by every feature module. Repositories live in one
// global module because the UnitOfWork needs all of them together.
@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (db: ConfigType<typeof databaseConfig>) =>
        typeOrmOptions(db.url, db.logging),
    }),
  ],
  providers: [...repositories, UnitOfWork, IsUniqueConstraint],
  exports: [...repositories, UnitOfWork],
})
export class DatabaseModule {}
