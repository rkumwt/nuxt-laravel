import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { TimestampedEntity } from '../../../database/timestamped.entity.js';
import { Company } from '../../companies/entities/company.entity.js';
import { UserType } from '../../users/user-type.enum.js';

@Entity('invitations')
export class Invitation extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId: number;

  @ManyToOne(() => Company, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: Relation<Company>;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  // Cleared once the invitation has been used
  @Index({ unique: true })
  @Column({ name: 'invite_code', type: 'varchar', length: 20, nullable: true })
  inviteCode: string | null;

  @Column({
    type: 'enum',
    enum: UserType,
    enumName: 'user_type',
    default: UserType.Member,
  })
  role: UserType;
}
