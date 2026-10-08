import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { QueryFailedError } from 'typeorm';
import { dayRange } from '../../common/utils/date.js';
import { paginated, type PageRequest } from '../../common/utils/pagination.js';
import { randomString } from '../../common/utils/random.js';
import { appConfig } from '../../config/app.config.js';
import {
  ShortUrlsRepository,
  type ShortUrlFilter,
} from '../../database/repositories/short-urls.repository.js';
import { UnitOfWork } from '../../database/unit-of-work.js';
import type { User } from '../users/entities/user.entity.js';
import { UserType } from '../users/user-type.enum.js';
import type {
  AllUrlsFilterDto,
  CompanyUrlsFilterDto,
} from './dto/short-url.dto.js';
import {
  toClientExportRow,
  toClientShortUrlResource,
  toCompanyExportRow,
  toCompanyShortUrlResource,
} from './short-url.resource.js';

const CODE_LENGTH = 6;
const MAX_CODE_ATTEMPTS = 5;

// Postgres unique_violation
const isUniqueViolation = (error: unknown) =>
  error instanceof QueryFailedError &&
  (error.driverError as { code?: string })?.code === '23505';

// Date filter only applies when both ends are given (like the Laravel controllers)
const createdBetween = ({ start_date, end_date }: CompanyUrlsFilterDto) =>
  start_date && end_date
    ? { createdBetween: dayRange(start_date, end_date) }
    : {};

@Injectable()
export class ShortUrlsService {
  constructor(
    private readonly shortUrls: ShortUrlsRepository,
    private readonly uow: UnitOfWork,
    @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
  ) {}

  // ---- Superadmin: every company's links --------------------------------

  private allFilter(filter: AllUrlsFilterDto): ShortUrlFilter {
    return { ...createdBetween(filter), companyId: filter.company_id };
  }

  async listAll(filter: AllUrlsFilterDto, page: PageRequest) {
    const { items, total } = await this.shortUrls.paginate(
      this.allFilter(filter),
      page,
    );
    return paginated(
      items.map(toClientShortUrlResource(this.app.url)),
      total,
      page,
    );
  }

  async *exportAll(filter: AllUrlsFilterDto) {
    for await (const url of this.shortUrls.iterate(this.allFilter(filter))) {
      yield toClientExportRow(url);
    }
  }

  // ---- Admin / member: own company (members only see their own links) ---

  private companyFilter(
    user: User,
    filter: CompanyUrlsFilterDto,
  ): ShortUrlFilter {
    return {
      ...createdBetween(filter),
      companyId: user.companyId,
      createdBy: user.type === UserType.Member ? user.id : undefined,
    };
  }

  async listForUser(
    user: User,
    filter: CompanyUrlsFilterDto,
    page: PageRequest,
  ) {
    const { items, total } = await this.shortUrls.paginate(
      this.companyFilter(user, filter),
      page,
    );
    return paginated(
      items.map(toCompanyShortUrlResource(this.app.url)),
      total,
      page,
    );
  }

  async *exportForUser(user: User, filter: CompanyUrlsFilterDto) {
    for await (const url of this.shortUrls.iterate(
      this.companyFilter(user, filter),
    )) {
      yield toCompanyExportRow(url);
    }
  }

  // Inserts with a random code; the unique index decides collisions, so two
  // concurrent requests can never get the same code. Postgres aborts a
  // transaction after an error, so each attempt is a new transaction.
  async generate(user: User, url: string) {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      try {
        return await this.uow.run(async (repos) => {
          const shortUrl = await repos.shortUrls.create({
            companyId: user.companyId,
            createdBy: user.id,
            url,
            shortUrlCode: randomString(CODE_LENGTH),
          });

          // Recount (self-healing) like the Laravel controller did
          await repos.companies.updateTotals(user.companyId, {
            totalUrls: await repos.shortUrls.countByCompany(user.companyId),
          });
          await repos.users.updateTotals(user.id, {
            totalUrls: await repos.shortUrls.countByCreator(user.id),
          });

          return shortUrl;
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
    throw new InternalServerErrorException(
      'Could not generate a unique short code. Please try again.',
    );
  }

  // Returns the destination and counts the hit for the link, company and creator
  resolve(code: string) {
    return this.uow.run(async (repos) => {
      const shortUrl = await repos.shortUrls.findByCode(code);
      if (!shortUrl) return null;

      await repos.shortUrls.incrementHits(shortUrl.id);
      await repos.companies.incrementUrlHits(shortUrl.companyId);
      await repos.users.incrementUrlHits(shortUrl.createdBy);

      return shortUrl.url;
    });
  }
}
