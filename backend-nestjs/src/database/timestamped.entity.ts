import { CreateDateColumn, UpdateDateColumn } from 'typeorm';

// Laravel's $table->timestamps()
export abstract class TimestampedEntity {
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', precision: 3 })
  updatedAt: Date;
}
