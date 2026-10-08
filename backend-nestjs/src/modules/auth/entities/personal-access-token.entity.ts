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
import { User } from '../../users/entities/user.entity.js';

// Laravel Sanctum's personal_access_tokens table
@Entity('personal_access_tokens')
export class PersonalAccessToken extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Index()
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  // SHA-256 of the plain-text token; the plain value is only shown once
  @Index({ unique: true })
  @Column({ type: 'char', length: 64 })
  token: string;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @Index()
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;
}
