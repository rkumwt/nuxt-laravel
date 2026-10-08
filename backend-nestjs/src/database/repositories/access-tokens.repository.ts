import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { PersonalAccessToken } from '../../modules/auth/entities/personal-access-token.entity.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class AccessTokensRepository extends BaseRepository<PersonalAccessToken> {
  constructor(@InjectEntityManager() manager: EntityManager) {
    super(manager, PersonalAccessToken);
  }

  create(data: {
    userId: number;
    name: string;
    token: string;
    expiresAt: Date | null;
  }) {
    return this.repo.save(this.repo.create(data));
  }

  findWithUser(id: number) {
    return this.repo.findOne({ where: { id }, relations: { user: true } });
  }

  findByHashWithUser(token: string) {
    return this.repo.findOne({ where: { token }, relations: { user: true } });
  }

  async touch(id: number) {
    await this.repo.update({ id }, { lastUsedAt: new Date() });
  }

  async delete(id: number) {
    await this.repo.delete({ id });
  }
}
