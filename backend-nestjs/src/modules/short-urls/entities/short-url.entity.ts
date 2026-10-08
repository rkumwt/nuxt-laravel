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
import { User } from '../../users/entities/user.entity.js';

@Entity('short_urls')
@Index(['companyId', 'createdAt'])
@Index(['createdAt'])
export class ShortUrl extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ name: 'company_id', type: 'int' })
  companyId: number;

  @ManyToOne(() => Company, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: Relation<Company>;

  @Column({ type: 'text' })
  url: string;

  // Unique + indexed: every redirect looks the link up by code
  @Index({ unique: true })
  @Column({ name: 'short_url_code', type: 'varchar', length: 20 })
  shortUrlCode: string;

  @Column({ type: 'int', default: 0 })
  hits: number;

  @Index()
  @Column({ name: 'created_by', type: 'int' })
  createdBy: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'created_by' })
  creator: Relation<User>;
}
