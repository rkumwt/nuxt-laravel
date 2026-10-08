import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, type SelectQueryBuilder } from 'typeorm';
import type { PageRequest } from '../../common/utils/pagination.js';
import { ShortUrl } from '../../modules/short-urls/entities/short-url.entity.js';
import { BaseRepository } from './base.repository.js';

export interface ShortUrlFilter {
  companyId?: number;
  createdBy?: number;
  createdBetween?: { from: Date; to: Date };
}

@Injectable()
export class ShortUrlsRepository extends BaseRepository<ShortUrl> {
  constructor(@InjectEntityManager() manager: EntityManager) {
    super(manager, ShortUrl);
  }

  // Shared list query: creator and their company joined, newest first,
  // id as tie-breaker so pages never overlap
  private listQuery({
    companyId,
    createdBy,
    createdBetween,
  }: ShortUrlFilter): SelectQueryBuilder<ShortUrl> {
    const qb = this.repo
      .createQueryBuilder('url')
      .innerJoinAndSelect('url.creator', 'creator')
      .innerJoinAndSelect('creator.company', 'company')
      .orderBy('url.createdAt', 'DESC')
      .addOrderBy('url.id', 'DESC');

    if (companyId !== undefined)
      qb.andWhere('url.companyId = :companyId', { companyId });
    if (createdBy !== undefined)
      qb.andWhere('url.createdBy = :createdBy', { createdBy });
    if (createdBetween) {
      qb.andWhere('url.createdAt BETWEEN :from AND :to', createdBetween);
    }
    return qb;
  }

  async paginate(filter: ShortUrlFilter, { skip, take }: PageRequest) {
    const [items, total] = await this.listQuery(filter)
      .offset(skip)
      .limit(take)
      .getManyAndCount();
    return { items, total };
  }

  // Streams every matching row in batches using keyset pagination
  // ((created_at, id) < last row), which stays fast on deep pages
  async *iterate(
    filter: ShortUrlFilter,
    batchSize = 1000,
  ): AsyncGenerator<ShortUrl> {
    let last: ShortUrl | undefined;

    while (true) {
      const qb = this.listQuery(filter).limit(batchSize);
      if (last) {
        qb.andWhere('(url.createdAt, url.id) < (:lastCreatedAt, :lastId)', {
          lastCreatedAt: last.createdAt,
          lastId: last.id,
        });
      }

      const batch = await qb.getMany();
      yield* batch;

      if (batch.length < batchSize) return;
      last = batch[batch.length - 1];
    }
  }

  findByCode(shortUrlCode: string) {
    return this.repo.findOneBy({ shortUrlCode });
  }

  create(data: {
    companyId: number;
    createdBy: number;
    url: string;
    shortUrlCode: string;
  }) {
    return this.repo.save(this.repo.create(data));
  }

  async incrementHits(id: number) {
    await this.repo.increment({ id }, 'hits', 1);
  }

  countByCompany(companyId: number) {
    return this.repo.countBy({ companyId });
  }

  countByCreator(createdBy: number) {
    return this.repo.countBy({ createdBy });
  }
}
