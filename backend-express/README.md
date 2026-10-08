# URL Shortener — Express API

Express 5 + TypeScript + Prisma 7 + PostgreSQL port of the Laravel API in
[`../backend`](../backend). The endpoints, request fields, response JSON and
validation messages are the same, so the Nuxt and Next frontends work against
either backend. See [`../LARAVEL_TO_EXPRESS_MIGRATION.md`](../LARAVEL_TO_EXPRESS_MIGRATION.md)
for how it was built.

## Requirements

- Node.js 20.19+
- Docker (for PostgreSQL), or any PostgreSQL 14+ server

## Setup

```bash
npm install                 # also generates the Prisma Client
cp .env.example .env
npm run db:up               # starts Postgres (docker compose) incl. the test database
npm run db:deploy           # applies migrations
npm run db:seed             # demo data unless NODE_ENV=production
npm run dev                 # http://localhost:8001
```

Logins (password `12345678`): `superadmin@example.com`, `admin@example.com`, `member@example.com`.

Point a frontend at this API:

```bash
# Nuxt (frontend/)
NUXT_PUBLIC_API_BASE=http://localhost:8001/api npm run dev
# Next (frontend-next/) — set in .env.local, then restart
NEXT_PUBLIC_API_BASE=http://localhost:8001/api
```

With `MAIL_MAILER=log`, invitation emails (and their links) are written to the console.

## Scripts

| Script | Laravel equivalent |
|---|---|
| `npm run dev` | `php artisan serve` (with reload) |
| `npm run build` / `npm start` | production build / run |
| `npm run db:migrate` | `php artisan make:migration` + `migrate` (from schema changes) |
| `npm run db:deploy` | `php artisan migrate --force` |
| `npm run db:seed` | `php artisan db:seed` |
| `npm run db:reset` | `php artisan migrate:fresh --seed` |
| `npm run db:studio` | DB GUI (Prisma Studio) |
| `npm test` | `php artisan test` (uses `url_shortener_test`) |
| `npm run lint` / `typecheck` / `format` | Pint / PHPStan |

## Structure

```
src/
  server.ts            process: listen, graceful shutdown
  app.ts               Express app: middleware, routes, error handling
  container.ts         composition root (dependency injection)
  config/env.ts        validated environment
  routes/              api.ts (routes/api.php), web.ts (routes/web.php)
  middlewares/         authenticate, authorize, validate, rate-limit, error-handler
  modules/<feature>/   *.routes, *.controller, *.service, *.schema, *.resource
  database/            repositories + unit of work (transactions)
  mail/                mailer strategy + email templates
  lib/                 prisma, logger, password hasher
  utils/ validation/   helpers, Laravel-style validation rules
prisma/                schema, migrations, seed, factories
tests/                 Vitest + Supertest
```
