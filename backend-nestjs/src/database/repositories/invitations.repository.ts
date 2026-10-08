import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { Invitation } from '../../modules/invitations/entities/invitation.entity.js';
import type { UserType } from '../../modules/users/user-type.enum.js';
import { BaseRepository } from './base.repository.js';

@Injectable()
export class InvitationsRepository extends BaseRepository<Invitation> {
  constructor(@InjectEntityManager() manager: EntityManager) {
    super(manager, Invitation);
  }

  findByCode(inviteCode: string) {
    return this.repo.findOne({
      where: { inviteCode },
      relations: { company: true },
    });
  }

  // Invitation::updateOrCreate(['email' => ...], [...]) as one INSERT … ON CONFLICT
  async upsertByEmail(data: {
    name: string;
    email: string;
    inviteCode: string;
    companyId: number;
    role: UserType;
  }) {
    await this.repo.upsert(data, { conflictPaths: ['email'] });
  }

  // A code can only be used once
  async clearCode(id: number) {
    await this.repo.update({ id }, { inviteCode: null });
  }
}
