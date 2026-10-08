import type { Prisma } from "../../generated/prisma/client.js";
import type { DbClient } from "../client.js";
import type { PageRequest } from "../../utils/pagination.js";

const withCompany = { company: { select: { id: true, name: true } } } as const;

export type UserWithCompany = Prisma.UserGetPayload<{ include: typeof withCompany }>;

export class UserRepository {
  constructor(private readonly db: DbClient) {}

  findByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }

  findById(id: number) {
    return this.db.user.findUnique({ where: { id } });
  }

  findWithCompany(id: number): Promise<UserWithCompany | null> {
    return this.db.user.findUnique({ where: { id }, include: withCompany });
  }

  async existsByEmail(email: string) {
    return (await this.db.user.count({ where: { email } })) > 0;
  }

  create(data: Prisma.UserUncheckedCreateInput) {
    return this.db.user.create({ data });
  }

  countByCompany(companyId: number) {
    return this.db.user.count({ where: { companyId } });
  }

  async paginateByCompany(companyId: number, { skip, take }: PageRequest) {
    const where = { companyId };
    const [items, total] = await Promise.all([
      this.db.user.findMany({ where, orderBy: { id: "asc" }, skip, take }),
      this.db.user.count({ where }),
    ]);
    return { items, total };
  }

  update(id: number, data: { totalUrls?: number }) {
    return this.db.user.update({ where: { id }, data });
  }

  incrementUrlHits(id: number) {
    return this.db.user.update({ where: { id }, data: { totalUrlHits: { increment: 1 } } });
  }
}
