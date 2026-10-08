import type { Prisma } from "../../generated/prisma/client.js";
import type { DbClient } from "../client.js";
import type { PageRequest } from "../../utils/pagination.js";

export interface ShortUrlFilter {
  companyId?: number;
  createdBy?: number;
  createdAt?: { gte: Date; lte: Date };
}

const listInclude = {
  creator: { select: { name: true, company: { select: { id: true, name: true } } } },
} as const;

export type ShortUrlListItem = Prisma.ShortUrlGetPayload<{ include: typeof listInclude }>;

// Newest first; id breaks ties so pages never overlap
const listOrder: Prisma.ShortUrlOrderByWithRelationInput[] = [
  { createdAt: "desc" },
  { id: "desc" },
];

const toWhere = ({
  companyId,
  createdBy,
  createdAt,
}: ShortUrlFilter): Prisma.ShortUrlWhereInput => ({
  ...(companyId !== undefined && { companyId }),
  ...(createdBy !== undefined && { createdBy }),
  ...(createdAt && { createdAt }),
});

export class ShortUrlRepository {
  constructor(private readonly db: DbClient) {}

  async paginate(filter: ShortUrlFilter, { skip, take }: PageRequest) {
    const where = toWhere(filter);
    const [items, total] = await Promise.all([
      this.db.shortUrl.findMany({ where, include: listInclude, orderBy: listOrder, skip, take }),
      this.db.shortUrl.count({ where }),
    ]);
    return { items, total };
  }

  // Streams every matching row in batches (keyset pagination) for exports
  async *iterate(filter: ShortUrlFilter, batchSize = 1000): AsyncGenerator<ShortUrlListItem> {
    const where = toWhere(filter);
    let cursor: number | undefined;

    while (true) {
      const batch = await this.db.shortUrl.findMany({
        where,
        include: listInclude,
        orderBy: listOrder,
        take: batchSize,
        ...(cursor !== undefined && { cursor: { id: cursor }, skip: 1 }),
      });

      yield* batch;

      if (batch.length < batchSize) return;
      cursor = batch[batch.length - 1]!.id;
    }
  }

  findByCode(shortUrlCode: string) {
    return this.db.shortUrl.findUnique({ where: { shortUrlCode } });
  }

  create(data: { companyId: number; createdBy: number; url: string; shortUrlCode: string }) {
    return this.db.shortUrl.create({ data });
  }

  incrementHits(id: number) {
    return this.db.shortUrl.update({ where: { id }, data: { hits: { increment: 1 } } });
  }

  countByCompany(companyId: number) {
    return this.db.shortUrl.count({ where: { companyId } });
  }

  countByCreator(createdBy: number) {
    return this.db.shortUrl.count({ where: { createdBy } });
  }
}
