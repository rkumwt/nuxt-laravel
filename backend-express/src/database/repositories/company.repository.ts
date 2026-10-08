import type { DbClient } from "../client.js";
import type { PageRequest } from "../../utils/pagination.js";

export class CompanyRepository {
  constructor(private readonly db: DbClient) {}

  findGlobal() {
    return this.db.company.findFirst({
      where: { isGlobal: true },
      select: { id: true, name: true },
    });
  }

  create(data: { name: string; email: string }) {
    return this.db.company.create({ data });
  }

  // Client companies (everyone except the platform owner)
  async paginateClients({ skip, take }: PageRequest) {
    const where = { isGlobal: false };
    const [items, total] = await Promise.all([
      this.db.company.findMany({ where, orderBy: { id: "asc" }, skip, take }),
      this.db.company.count({ where }),
    ]);
    return { items, total };
  }

  update(id: number, data: { totalUsers?: number; totalUrls?: number }) {
    return this.db.company.update({ where: { id }, data });
  }

  incrementUrlHits(id: number) {
    return this.db.company.update({ where: { id }, data: { totalUrlHits: { increment: 1 } } });
  }
}
