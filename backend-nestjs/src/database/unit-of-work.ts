import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AccessTokensRepository } from './repositories/access-tokens.repository.js';
import { CompaniesRepository } from './repositories/companies.repository.js';
import { InvitationsRepository } from './repositories/invitations.repository.js';
import { ShortUrlsRepository } from './repositories/short-urls.repository.js';
import { UsersRepository } from './repositories/users.repository.js';

export interface Repositories {
  accessTokens: AccessTokensRepository;
  companies: CompaniesRepository;
  invitations: InvitationsRepository;
  shortUrls: ShortUrlsRepository;
  users: UsersRepository;
}

// DB::transaction() — runs work against repositories bound to one transaction
@Injectable()
export class UnitOfWork {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly accessTokens: AccessTokensRepository,
    private readonly companies: CompaniesRepository,
    private readonly invitations: InvitationsRepository,
    private readonly shortUrls: ShortUrlsRepository,
    private readonly users: UsersRepository,
  ) {}

  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    return this.dataSource.transaction((manager) =>
      work({
        accessTokens: this.accessTokens.withManager(manager),
        companies: this.companies.withManager(manager),
        invitations: this.invitations.withManager(manager),
        shortUrls: this.shortUrls.withManager(manager),
        users: this.users.withManager(manager),
      }),
    );
  }
}
