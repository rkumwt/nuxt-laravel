import 'dotenv/config';
import { DataSource } from 'typeorm';
import { typeOrmOptions } from './typeorm.options.js';

// Used by the TypeORM CLI (migration:generate / run / revert) and the seeder
export default new DataSource(typeOrmOptions(process.env.DATABASE_URL ?? ''));
