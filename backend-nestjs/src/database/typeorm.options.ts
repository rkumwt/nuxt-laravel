import { fileURLToPath } from 'node:url';
import type { DataSourceOptions } from 'typeorm';
import { entities } from './entities.js';

// Migrations are .ts when run from source (tsx) and .js from the build
const extension = import.meta.url.endsWith('.ts') ? 'ts' : 'js';
const migrations = fileURLToPath(
  new URL(`./migrations/*.${extension}`, import.meta.url),
);

// Shared by the Nest app (TypeOrmModule) and the CLI / seeder (data-source.ts)
export const typeOrmOptions = (
  url: string,
  logging = false,
): DataSourceOptions => ({
  type: 'postgres',
  url,
  entities,
  migrations: [migrations],
  // Schema changes only ever happen through migrations
  synchronize: false,
  logging,
});
