import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import type { PageRequest } from '../../common/utils/pagination.js';
import { Company } from '../../modules/companies/entities/company.entity.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class CompaniesRepository extends BaseRepository<Company> {
  constructor(@InjectEntityManager() manager: EntityManager) {
    super(manager, Company);
  }

  findGlobal() {
    return this.repo.findOne({
      where: { isGlobal: true },
      select: { id: true, name: true },
    });
  }

  create(data: { name: string; email: string }) {
    return this.repo.save(this.repo.create(data));
  }

  // Client companies (everyone except the platform owner)
  async paginateClients({ skip, take }: PageRequest) {
    const [items, total] = await this.repo.findAndCount({
      where: { isGlobal: false },
      order: { id: 'ASC' },
      skip,
      take,
    });
    return { items, total };
  }

  async updateTotals(
    id: number,
    data: { totalUsers?: number; totalUrls?: number },
  ) {
    await this.repo.update({ id }, data);
  }

  async incrementUrlHits(id: number) {
    await this.repo.increment({ id }, 'totalUrlHits', 1);
  }
}
