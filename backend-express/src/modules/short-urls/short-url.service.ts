import type { ShortUrlFilter } from "../../database/repositories/short-url.repository.js";
import type { Repositories, UnitOfWork } from "../../database/unit-of-work.js";
import { Prisma, type User } from "../../generated/prisma/client.js";
import { dayRange } from "../../utils/date.js";
import { HttpError } from "../../utils/http-error.js";
import { paginated, type PageRequest } from "../../utils/pagination.js";
import { randomString } from "../../utils/random.js";
import type { AllUrlsFilter, CompanyUrlsFilter } from "./short-url.schema.js";
import {
  toClientExportRow,
  toClientShortUrlResource,
  toCompanyExportRow,
  toCompanyShortUrlResource,
} from "./short-url.resource.js";

const CODE_LENGTH = 6;
const MAX_CODE_ATTEMPTS = 5;

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

// Date filter only applies when both ends are given (like the Laravel controllers)
const createdBetween = ({ start_date, end_date }: CompanyUrlsFilter) =>
  start_date && end_date ? { createdAt: dayRange(start_date, end_date) } : {};

export class ShortUrlService {
  constructor(
    private readonly repos: Repositories,
    private readonly uow: UnitOfWork,
    private readonly appUrl: string,
  ) {}

  // ---- Superadmin: every company's links --------------------------------

  private allFilter(filter: AllUrlsFilter): ShortUrlFilter {
    return { ...createdBetween(filter), companyId: filter.company_id };
  }

  async listAll(filter: AllUrlsFilter, page: PageRequest) {
    const { items, total } = await this.repos.shortUrls.paginate(this.allFilter(filter), page);
    return paginated(items.map(toClientShortUrlResource(this.appUrl)), total, page);
  }

  async *exportAll(filter: AllUrlsFilter) {
    for await (const url of this.repos.shortUrls.iterate(this.allFilter(filter))) {
      yield toClientExportRow(url);
    }
  }

  // ---- Admin / member: own company (members only see their own links) ---

  private companyFilter(user: User, filter: CompanyUrlsFilter): ShortUrlFilter {
    return {
      ...createdBetween(filter),
      companyId: user.companyId,
      createdBy: user.type === "member" ? user.id : undefined,
    };
  }

  async listForUser(user: User, filter: CompanyUrlsFilter, page: PageRequest) {
    const { items, total } = await this.repos.shortUrls.paginate(
      this.companyFilter(user, filter),
      page,
    );
    return paginated(items.map(toCompanyShortUrlResource(this.appUrl)), total, page);
  }

  async *exportForUser(user: User, filter: CompanyUrlsFilter) {
    for await (const url of this.repos.shortUrls.iterate(this.companyFilter(user, filter))) {
      yield toCompanyExportRow(url);
    }
  }

  // Inserts with a random code; the unique index decides collisions, so two
  // concurrent requests can never get the same code
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
          await repos.companies.update(user.companyId, {
            totalUrls: await repos.shortUrls.countByCompany(user.companyId),
          });
          await repos.users.update(user.id, {
            totalUrls: await repos.shortUrls.countByCreator(user.id),
          });

          return shortUrl;
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
    throw new HttpError(500, "Could not generate a unique short code. Please try again.");
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
