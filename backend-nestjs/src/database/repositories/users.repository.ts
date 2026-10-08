import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import type { PageRequest } from '../../common/utils/pagination.js';
import { User } from '../../modules/users/entities/user.entity.js';
import type {
  UserStatus,
  UserType,
} from '../../modules/users/user-type.enum.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class UsersRepository extends BaseRepository<User> {
  constructor(@InjectEntityManager() manager: EntityManager) {
    super(manager, User);
  }

  // The password column is select: false, so login asks for it explicitly
  findByEmailWithPassword(email: string) {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  findWithCompany(id: number) {
    return this.repo.findOne({ where: { id }, relations: { company: true } });
  }

  existsByEmail(email: string) {
    return this.repo.existsBy({ email });
  }

  create(data: {
    companyId: number;
    name: string;
    email: string;
    password: string;
    type: UserType;
    status: UserStatus;
  }) {
    return this.repo.save(this.repo.create(data));
  }

  countByCompany(companyId: number) {
    return this.repo.countBy({ companyId });
  }

  async paginateByCompany(companyId: number, { skip, take }: PageRequest) {
    const [items, total] = await this.repo.findAndCount({
      where: { companyId },
      order: { id: 'ASC' },
      skip,
      take,
    });
    return { items, total };
  }

  async updateTotals(id: number, data: { totalUrls: number }) {
    await this.repo.update({ id }, data);
  }

  async incrementUrlHits(id: number) {
    await this.repo.increment({ id }, 'totalUrlHits', 1);
  }
}
