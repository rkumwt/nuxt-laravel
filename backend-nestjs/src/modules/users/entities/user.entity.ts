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
import { UserStatus, UserType } from '../user-type.enum.js';

@Entity('users')
export class User extends TimestampedEntity {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Index()
  @Column({ name: 'company_id', type: 'int' })
  companyId: number;

  @ManyToOne(() => Company, (company) => company.users, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'company_id' })
  company: Relation<Company>;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  // Like Laravel's $hidden: never loaded unless explicitly selected
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  password: string | null;

  @Column({
    type: 'enum',
    enum: UserType,
    enumName: 'user_type',
    default: UserType.Admin,
  })
  type: UserType;

  @Column({
    type: 'enum',
    enum: UserStatus,
    enumName: 'user_status',
    default: UserStatus.Pending,
  })
  status: UserStatus;

  @Column({ name: 'total_urls', type: 'int', default: 0 })
  totalUrls: number;

  @Column({ name: 'total_url_hits', type: 'int', default: 0 })
  totalUrlHits: number;
}
