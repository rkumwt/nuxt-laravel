import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { TimestampedEntity } from '../../../database/timestamped.entity.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('companies')
export class Company extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ name: 'total_users', type: 'int', default: 1 })
  totalUsers: number;

  @Column({ name: 'total_urls', type: 'int', default: 0 })
  totalUrls: number;

  @Column({ name: 'total_url_hits', type: 'int', default: 0 })
  totalUrlHits: number;

  // The platform owner's company; clients are invited into it
  @Index()
  @Column({ name: 'is_global', type: 'boolean', default: false })
  isGlobal: boolean;

  @OneToMany(() => User, (user) => user.company)
  users: Relation<User[]>;
}
