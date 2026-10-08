# URL Shortener — NestJS API

NestJS 12 + TypeORM 1 + PostgreSQL port of the Laravel API in [`../backend`](../backend).
Endpoints, request fields, response JSON and validation messages are identical, so the Nuxt
and Next frontends work against it unchanged. See
[`../LARAVEL_TO_NESTJS_MIGRATION.md`](../LARAVEL_TO_NESTJS_MIGRATION.md) for how it was built.

## Requirements

- Node.js 20.19+ / 22.12+
- Docker (for PostgreSQL), or any PostgreSQL 14+ server

## Setup

```bash
npm install
cp .env.example .env
npm run db:up               # Postgres on localhost:5433 (+ url_shortener_test)
npm run migration:run       # php artisan migrate
npm run db:seed             # php artisan db:seed (demo data unless NODE_ENV=production)
npm run start:dev           # http://localhost:8002
```

Logins (password `12345678`): `superadmin@example.com`, `admin@example.com`, `member@example.com`.

Point a frontend at this API with `NUXT_PUBLIC_API_BASE` / `NEXT_PUBLIC_API_BASE=http://localhost:8002/api`.
With `MAIL_MAILER=log`, invitation emails (and their links) are written to the log.

## Scripts

| Script | Laravel equivalent |
|---|---|
| `npm run start:dev` | `php artisan serve` (with reload) |
| `npm run build` / `npm run start:prod` | production build / run |
| `npm run migration:generate -- src/database/migrations/<Name>` | `make:migration` (diffed from entities) |
| `npm run migration:run` / `migration:revert` | `migrate` / `migrate:rollback` |
| `npm run migration:run:prod` | `migrate --force` (from `dist/`) |
| `npm run db:seed` | `db:seed` |
| `npm run db:fresh` | `migrate:fresh --seed` |
| `npm test` | unit tests (`*.spec.ts`, mocked dependencies) |
| `npm run test:e2e` | HTTP tests against `url_shortener_test` |
| `npm run lint` / `typecheck` / `format` | Pint / PHPStan |

## Structure

```
src/
  main.ts                  bootstrap (logger, listen)
  configure-app.ts         helmet, CORS, /api prefix, shutdown hooks (shared with e2e tests)
  app.module.ts            root module: config, logger, throttler, global guards/pipe/interceptor/filter
  config/                  registerAs() namespaces + env validation
  common/                  decorators, filter, interceptor, validation pipe & rules, utils
  database/                TypeORM options, data source (CLI), repositories, unit of work, migrations, seeds
  modules/
    auth/                  login/user/logout, access tokens, guards
    invitations/           show/register + shared invite logic
    clients/               superadmin: clients list + invite
    team-members/          admin: team list + invite
    short-urls/            lists, generate, CSV export, redirect
    mail/                  mailer strategy + templates
    health/                /up (terminus)
    users/, companies/     entities and enums
test/                      e2e specs (Vitest + Supertest)
```
