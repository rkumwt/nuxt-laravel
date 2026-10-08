# Migrating a Laravel API to Express.js + PostgreSQL — A Practical Guide

This guide converts the **URL Shortener API** from **Laravel 12 + MySQL** in `backend/`
to **Express 5 + TypeScript + Prisma 7 + PostgreSQL** in `backend-express/`.

The goal was a **drop-in replacement**: same endpoints, request fields, response JSON,
status codes and validation messages, so the Nuxt (`frontend/`) and Next.js
(`frontend-next/`) apps work against either backend by changing one URL.

The guide maps every Laravel concept to its Express equivalent, shows the migrated code
file by file, explains the design patterns and best practices behind the structure, and
ends with interview questions.

| | Laravel app | Express app |
|---|---|---|
| Language / runtime | PHP 8.3 | TypeScript 5 on Node.js 20.19+ (ESM) |
| Framework | Laravel 12 | Express 5 |
| Database | MySQL (SQLite locally) | PostgreSQL 17 (Docker) |
| ORM / migrations | Eloquent + migrations | Prisma 7 (`@prisma/adapter-pg`) |
| Validation | FormRequest rules | Zod 4 |
| Auth | Sanctum personal access tokens | Same token scheme, implemented in `AccessTokenService` |
| Mail | Mailables + Blade | Nodemailer + template functions |
| CSV export | maatwebsite/excel | `csv-stringify` (streamed) |
| Logging | Monolog | Pino + pino-http |
| Tests | PHPUnit | Vitest + Supertest |
| Port | 8000 | 8001 |

---

## Table of Contents

1. [Mental model: framework vs. assembled stack](#1-mental-model-framework-vs-assembled-stack)
2. [Concept map: Laravel → Express](#2-concept-map-laravel--express)
3. [Package choices and why](#3-package-choices-and-why)
4. [Folder structure and file map](#4-folder-structure-and-file-map)
5. [Design patterns used](#5-design-patterns-used)
6. [Step 1 — Project setup (TypeScript, ESM, tooling)](#6-step-1--project-setup)
7. [Step 2 — PostgreSQL with Docker](#7-step-2--postgresql-with-docker)
8. [Step 3 — Configuration: `.env` + `config/*.php` → validated env](#8-step-3--configuration)
9. [Step 4 — Migrations → Prisma schema](#9-step-4--migrations--prisma-schema)
10. [Step 5 — Eloquent → Prisma Client + repositories](#10-step-5--eloquent--prisma-client--repositories)
11. [Step 6 — Seeders and factories](#11-step-6--seeders-and-factories)
12. [Step 7 — Bootstrapping: `public/index.php` + `bootstrap/app.php` → `server.ts` + `app.ts`](#12-step-7--bootstrapping)
13. [Step 8 — Routes](#13-step-8--routes)
14. [Step 9 — Middleware, authentication (Sanctum) and authorization](#14-step-9--middleware-authentication-and-authorization)
15. [Step 10 — FormRequest validation → Zod](#15-step-10--formrequest-validation--zod)
16. [Step 11 — Controllers → controllers + services](#16-step-11--controllers--controllers--services)
17. [Step 12 — API Resources (response shaping)](#17-step-12--api-resources)
18. [Step 13 — Exception handler → error middleware](#18-step-13--exception-handler--error-middleware)
19. [Step 14 — Mail](#19-step-14--mail)
20. [Step 15 — Excel exports → streamed CSV](#20-step-15--excel-exports--streamed-csv)
21. [Step 16 — Testing](#21-step-16--testing)
22. [MySQL → PostgreSQL differences that mattered](#22-mysql--postgresql-differences)
23. [Bugs fixed and behaviour changes](#23-bugs-fixed-and-behaviour-changes)
24. [Security and production checklist](#24-security-and-production-checklist)
25. [Pitfalls hit during the migration](#25-pitfalls-hit-during-the-migration)
26. [Interview questions and answers](#26-interview-questions-and-answers)
27. [Migration checklist](#27-migration-checklist)

---

## 1. Mental model: framework vs. assembled stack

Laravel is a **full-stack framework**: routing, container, ORM, validation, auth, mail,
queues, testing and the CLI ship together and follow one set of conventions.

Express is a **minimal HTTP layer**: a router, a middleware pipeline, and request/response
helpers. Everything else is a **library you choose**, and **the structure is your
responsibility**. So migrating means:

1. Choosing well-maintained, standard packages for each Laravel feature (§3).
2. Recreating the **architecture** Laravel gave you for free: a composition root
   (container), layers, conventions (§4, §5).
3. Re-implementing small framework behaviours your clients depend on: response envelope,
   validation message format, token format (§14–§18).

| Laravel gives you | In Express you |
|---|---|
| Service container + auto-injection | Build a **composition root** (`container.ts`) and inject via constructors |
| Conventions (`app/Http/Controllers`, …) | Pick a structure (feature modules) and stick to it |
| `artisan` generators | Write files; use `prisma` CLI for the DB side |
| Global helpers (`auth()`, `request()`, `config()`) | Explicit imports and parameters (more testable) |
| Synchronous PHP, one process per request | **Async, single-threaded event loop**; one long-lived process serves many requests concurrently |

The last row matters most for a PHP developer:

- **State lives across requests.** A module-level variable is shared by every request the
  process serves. Never keep per-request data in module scope; put it on `req` or
  `res.locals`.
- **Never block the event loop.** CPU-heavy work (hashing with high bcrypt cost, huge JSON,
  sync file I/O) stalls *all* requests. Use async APIs, streams and worker threads.
- **Connections are pooled and reused.** One Prisma client (one pool) per process, created at
  startup and closed on shutdown.
- **Errors must be awaited.** An unhandled rejected promise doesn't map to a 500 by itself.
  Express 5 now forwards rejected handler promises to the error middleware (Express 4 did not).

---

## 2. Concept map: Laravel → Express

| Laravel | Express project equivalent | File(s) |
|---|---|---|
| `public/index.php` | `server.ts` (process entry, `listen`, signals) | `src/server.ts` |
| `bootstrap/app.php` (`withRouting`, `withMiddleware`, `withExceptions`) | `createApp()` | `src/app.ts` |
| Service container / providers | Composition root `createContainer()` | `src/container.ts` |
| `config/*.php` + `env()` | Zod-validated `config` object | `src/config/env.ts` |
| `routes/api.php`, `routes/web.php` | `Router()` factories | `src/routes/api.ts`, `src/routes/web.ts` |
| `Route::prefix()->middleware()->group()` | `router.use('/prefix', mw, subRouter)` | `src/routes/api.ts` |
| Controller | Controller class with arrow-function handlers | `src/modules/*/*.controller.ts` |
| (fat controller logic) | **Service** class | `src/modules/*/*.service.ts` |
| Eloquent model | Prisma model + generated types | `prisma/schema.prisma` |
| Eloquent queries in controllers | **Repository** classes | `src/database/repositories/*` |
| `DB::transaction()` | `UnitOfWork.run()` → `prisma.$transaction()` | `src/database/unit-of-work.ts` |
| Migrations | Prisma migrations (generated SQL) | `prisma/migrations/*` |
| Seeders / factories | `prisma/seed.ts`, `prisma/factories.ts` (Faker) | |
| FormRequest `rules()` | Zod schema + `validate()` middleware | `*.schema.ts`, `src/middlewares/validate.ts` |
| FormRequest `authorize()` | `authorize(...roles)` middleware | `src/middlewares/authorize.ts` |
| `auth:sanctum` | `authenticate(accessTokens)` middleware | `src/middlewares/authenticate.ts` |
| Sanctum `HasApiTokens::createToken()` | `AccessTokenService.issue()` | `src/modules/auth/access-token.service.ts` |
| `$request->user()` | `req.auth.user` / `authUser(req)` | `src/utils/auth-user.ts` |
| API Resource / `$hidden` / `$appends` | Resource mapper functions | `src/modules/*/*.resource.ts` |
| `abort()` / exceptions | `throw new HttpError(...)` subclasses | `src/utils/http-error.ts` |
| Exception handler | Error-handling middleware | `src/middlewares/error-handler.ts` |
| `Hash::make()` / `Hash::check()` | `PasswordHasher` (bcryptjs) | `src/lib/hash.ts` |
| `Str::random()` | `randomString()` (crypto) | `src/utils/random.ts` |
| Mailable + Blade view | Template function + `Mailer` interface | `src/mail/*` |
| `Mail::to()->send()` | `mailer.send({ to, subject, html })` | |
| maatwebsite/excel export | `csv-stringify` stream | `src/utils/csv.ts` |
| `Log::` (Monolog) | Pino logger | `src/lib/logger.ts` |
| `throttle` middleware | `express-rate-limit` | `src/middlewares/rate-limit.ts` |
| `config/cors.php` (HandleCors) | `cors` middleware | `src/app.ts` |
| Paginator `->paginate()` | `paginationSchema` + `paginated()` helpers | `src/utils/pagination.ts` |
| `Carbon::format('d M Y')` | `formatDayMonthYear()` | `src/utils/date.ts` |
| `php artisan serve` | `npm run dev` (`tsx watch`) | |
| `php artisan migrate` | `npm run db:deploy` / `db:migrate` | |
| `php artisan test` | `npm test` (Vitest) | |
| `/up` health route | `/up` with a DB ping | `src/routes/web.ts` |

---

## 3. Package choices and why

All are widely used, actively maintained "default" choices in the Node ecosystem.

### Runtime dependencies

| Package | Role | Why this one |
|---|---|---|
| `express@5` | HTTP framework | The standard; v5 adds **native async error handling** and modern path matching |
| `@prisma/client` + `@prisma/adapter-pg` + `pg` | ORM + Postgres driver | Type-safe queries generated from a schema, first-class migrations: the closest DX to Eloquent + migrations. Prisma 7 uses JS **driver adapters** (`pg`) instead of a Rust engine binary |
| `zod` | Validation | Schema-first, infers TS types from schemas (one source of truth for validation and typing) |
| `bcryptjs` | Password hashing | Same algorithm as Laravel's default hasher; pure JS (no native build) |
| `helmet` | Security headers | Sensible defaults (CSP, `nosniff`, HSTS, frame options…) |
| `cors` | CORS | Replaces `config/cors.php` |
| `express-rate-limit` | Throttling | Replaces Laravel's `throttle` middleware |
| `pino` + `pino-http` | Structured logging | Fast JSON logs, request logging with redaction |
| `nodemailer` | Email | The de-facto SMTP client |
| `csv-stringify` | CSV | Streaming CSV writer |
| `dotenv` | `.env` loading | Also used by `prisma.config.ts` |

### Development dependencies

| Package | Role |
|---|---|
| `typescript@5`, `tsx` | Compile for production; run TS directly with watch mode in dev |
| `prisma` | CLI: migrate, generate, seed, studio |
| `vitest`, `supertest` | Test runner; HTTP assertions against the Express app without opening a port |
| `@faker-js/faker` | Factories/seed data (Laravel's `fake()`) |
| `eslint`, `typescript-eslint`, `prettier` | Lint + format (Laravel Pint / PHPStan equivalents) |
| `pino-pretty` | Human-readable logs in development |

> **Version notes (Oct 2026):** npm's `latest` tag for `prisma` pointed to an 8.0 **release
> candidate**, so the stable **7.10.0** is pinned. TypeScript is pinned to **5.x**: TS 7 (the
> native port) isn't supported by all tooling yet.

---

## 4. Folder structure and file map

**Feature-based modules** (by domain), with shared infrastructure beside them. This
scales better than Laravel-style "by type" folders (`controllers/`, `models/`, …) because
everything about a feature lives together.

```
backend-express/
├── docker-compose.yml            # PostgreSQL 17 (+ test DB via docker/postgres/init.sql)
├── prisma.config.ts              # Prisma 7 config (schema path, migrations, seed, DB url)
├── prisma/
│   ├── schema.prisma             # ← database/migrations + app/Models
│   ├── migrations/<ts>_init/     # generated SQL
│   ├── factories.ts              # ← database/factories
│   └── seed.ts                   # ← database/seeders
├── src/
│   ├── server.ts                 # ← public/index.php (listen, graceful shutdown)
│   ├── app.ts                    # ← bootstrap/app.php (middleware, routes, errors)
│   ├── container.ts              # ← service container (composition root)
│   ├── config/env.ts             # ← config/*.php + .env (validated)
│   ├── routes/api.ts, web.ts     # ← routes/api.php, routes/web.php
│   ├── middlewares/              # authenticate, authorize, validate, rate-limit, error-handler
│   ├── modules/
│   │   ├── auth/                 # login, user, logout, access tokens
│   │   ├── invitations/          # show/register invitation, shared invite logic
│   │   ├── clients/              # superadmin: clients list + invite
│   │   ├── team-members/         # admin: team list + invite
│   │   └── short-urls/           # lists, generate, CSV export, redirect
│   │       ├── short-url.routes.ts
│   │       ├── short-url.controller.ts, redirect.controller.ts
│   │       ├── short-url.service.ts
│   │       ├── short-url.schema.ts   # ← FormRequests
│   │       └── short-url.resource.ts # ← API Resource / Export mapping
│   ├── database/
│   │   ├── client.ts             # DbClient type (client or transaction)
│   │   ├── repositories/         # data access per aggregate
│   │   └── unit-of-work.ts       # transactions across repositories
│   ├── mail/                     # Mailer strategy + templates (← app/Mail + Blade emails)
│   ├── lib/                      # prisma singleton, logger, password hasher
│   ├── validation/rules.ts       # Laravel-compatible rule builders and messages
│   ├── utils/                    # HttpError, response envelope, pagination, csv, dates…
│   ├── types/                    # Express Request augmentation, helper types
│   └── generated/prisma/         # Prisma Client output (git-ignored)
└── tests/                        # Vitest: integration (real Postgres) + unit
```

### Laravel → Express file map

| Laravel (`backend/`) | Express (`backend-express/`) |
|---|---|
| `database/migrations/*_create_companies_table.php` (+4 more) | `prisma/schema.prisma` → `prisma/migrations/*/migration.sql` |
| `app/Models/{Company,User,ShortUrl,Invitation}.php` | `prisma/schema.prisma` models + `src/database/repositories/*` |
| `app/Http/Controllers/ApiBaseController.php` | `src/utils/api-response.ts` |
| `app/Http/Requests/ApiBaseRequest.php` | `src/middlewares/validate.ts` + `src/validation/rules.ts` |
| `app/Http/Requests/Api/LoginRequest.php` | `src/modules/auth/auth.schema.ts` |
| `app/Http/Requests/Invitation/RegisterRequest.php` | `src/modules/invitations/invitation.schema.ts` |
| `app/Http/Requests/Api/Superadmin/Clients/*` | `inviteSchema` + `authorize("superadmin")` |
| `app/Http/Requests/Api/Admin/TeamMembers/*` | `teamMemberInviteSchema` + `authorize("admin")` |
| `app/Http/Requests/Api/*/ShortUrls/*` | `src/modules/short-urls/short-url.schema.ts` + `authorize(...)` |
| `app/Http/Controllers/Api/AuthController.php` | `src/modules/auth/{auth.controller,auth.service,access-token.service}.ts` |
| `app/Http/Controllers/Api/InvitationController.php` | `src/modules/invitations/{invitation.controller,invitation.service}.ts` |
| `app/Http/Controllers/Api/Superadmin/ClientsController.php` | `src/modules/clients/*` |
| `app/Http/Controllers/Api/Admin/TeamMembersController.php` | `src/modules/team-members/*` |
| `app/Http/Controllers/Api/{Superadmin,Admin}/ShortUrlsController.php` | `src/modules/short-urls/{short-url.controller,short-url.service}.ts` |
| `app/Http/Controllers/ShortUrlRedirectController.php` | `src/modules/short-urls/redirect.controller.ts` |
| `app/Exports/{ShortUrlExport,AdminShortUrlExport}.php` | `short-url.resource.ts` (rows) + `src/utils/csv.ts` |
| `app/Mail/{InviteMailClient,InviteMailTeamMember}.php` + `resources/views/emails/*` | `src/mail/templates/{invitations,layout}.ts` + `src/mail/mailer.ts` |
| `bootstrap/app.php` | `src/app.ts` |
| `routes/api.php`, `routes/web.php` | `src/routes/api.ts`, `src/routes/web.ts` |
| `config/cors.php`, `config/sanctum.php`, `config/mail.php`… | `src/config/env.ts` |
| `database/seeders/*`, `database/factories/*` | `prisma/seed.ts`, `prisma/factories.ts` |
| `tests/` (PHPUnit) | `tests/` (Vitest + Supertest), `vitest.config.ts` |

---

## 5. Design patterns used

| Pattern | Where | What it buys you |
|---|---|---|
| **Layered architecture** (Routes → Controller → Service → Repository → DB) | every module | HTTP concerns, business rules and persistence change independently; services are testable without Express |
| **Dependency Injection** via constructors | all services/controllers | No hidden globals; swap implementations (e.g. a fake mailer in tests) |
| **Composition Root** | `src/container.ts` | The single place that wires the object graph (Laravel's container, but explicit) |
| **Repository** | `src/database/repositories/*` | Hides Prisma behind intention-revealing methods (`paginateClients`, `incrementUrlHits`) |
| **Unit of Work** | `src/database/unit-of-work.ts` | Runs several repository calls in one transaction with transaction-bound repositories |
| **Strategy** | `Mailer` interface → `SmtpMailer` / `LogMailer` / `FakeMailer` | Transport chosen by config (`MAIL_MAILER`), not by `if`s in business code |
| **Factory functions** | `createApp`, `createContainer`, `createMailer`, `authRoutes(...)`, `authenticate(...)` | Build configured instances; makes the app constructible in tests without listening on a port |
| **Middleware / Chain of Responsibility** | `authenticate → authorize → validate → controller` | Each step can stop the chain by throwing |
| **Adapter** | `PrismaPg` driver adapter; `PasswordHasher` around bcryptjs | Isolate third-party APIs behind your own interface |
| **DTO / Presenter (API Resource)** | `*.resource.ts` | DB models (camelCase, booleans) never leak; the API contract (snake_case, `is_global: 0/1`) is explicit |
| **Iterator / Generator** | `ShortUrlRepository.iterate()`, `ShortUrlService.exportAll()` | Stream large exports in batches with constant memory |
| **Singleton (module-level)** | `src/lib/prisma.ts`, `src/lib/logger.ts` | One connection pool / logger per process |
| **Fail-fast configuration** | `src/config/env.ts` | A misconfigured app exits at boot instead of failing at the first request |

### The request flow

```
HTTP request
  → helmet, cors, pino-http, express.json            (global middleware: app.ts)
  → /api router                                       (routes/api.ts)
    → authenticate(accessTokens)                      (auth:sanctum)
    → authorize("admin", "member")                    (FormRequest::authorize)
    → validate(generateSchema)                        (FormRequest::rules)
    → ShortUrlController.generate                     (HTTP in/out only)
      → ShortUrlService.generate                      (business rules)
        → UnitOfWork.run(repos => …)                  (DB::transaction)
          → ShortUrlRepository.create / CompanyRepository.update …
  → sendSuccess(res, ...)                             ({ status, message, data })
errors thrown anywhere → errorHandler                 (bootstrap/app.php withExceptions)
```

---

## 6. Step 1 — Project setup

```bash
mkdir backend-express && cd backend-express
npm init -y
npm pkg set type=module            # ESM, required by Prisma 7's generated client
npm i express@^5 cors helmet express-rate-limit pino pino-http zod bcryptjs nodemailer \
      csv-stringify dotenv pg @prisma/client@7.10.0 @prisma/adapter-pg@7.10.0
npm i -D prisma@7.10.0 typescript@^5 tsx @types/node@^22 @types/express @types/cors \
      @types/nodemailer @types/pg @types/supertest @faker-js/faker vitest supertest \
      eslint @eslint/js typescript-eslint prettier pino-pretty
```

### `tsconfig.json` (Node ESM)

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- `module/moduleResolution: NodeNext` matches how Node actually resolves ESM, so relative
  imports need the **`.js` extension** (`import { x } from "./x.js"`), even in `.ts` files.
  This surprises most people coming from bundlers.
- `strict` + `noUncheckedIndexedAccess`: array/record access returns `T | undefined`,
  catching a class of runtime errors PHP would only show at runtime.
- `verbatimModuleSyntax` forces `import type` for types (enforced by ESLint too), so type
  imports are erased predictably.
- A second `tsconfig.check.json` type-checks `prisma/`, `tests/` and configs without
  emitting.

### Scripts (`package.json`)

```json
{
  "dev": "tsx watch --clear-screen=false src/server.ts",
  "build": "tsc",
  "start": "node --enable-source-maps dist/server.js",
  "typecheck": "tsc -p tsconfig.check.json",
  "lint": "eslint .",
  "format": "prettier --write .",
  "test": "vitest run",
  "db:up": "docker compose up -d --wait",
  "db:generate": "prisma generate",
  "db:migrate": "prisma migrate dev",
  "db:deploy": "prisma migrate deploy",
  "db:seed": "prisma db seed",
  "db:reset": "prisma migrate reset --force && prisma db seed",
  "db:studio": "prisma studio",
  "postinstall": "prisma generate"
}
```

| Artisan | npm script |
|---|---|
| `php artisan serve` | `npm run dev` |
| `php artisan migrate` (prod) | `npm run db:deploy` |
| `make:migration` + `migrate` (dev) | edit `schema.prisma` → `npm run db:migrate -- --name <change>` |
| `migrate:fresh --seed` | `npm run db:reset` |
| `db:seed` | `npm run db:seed` |
| `test` | `npm test` |

> **Gotcha:** `prisma init` (v7) also downloads "agent skill" folders (`.claude/`,
> `.agents/`, `.windsurf/`, `skills-lock.json`) and names the config `prisma7.config.ts`.
> They were removed, and the config renamed to the standard `prisma.config.ts`.

---

## 7. Step 2 — PostgreSQL with Docker

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:17-alpine
    container_name: url-shortener-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: url_shortener
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: url_shortener
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
      # Creates the test database on first start
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U url_shortener -d url_shortener"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  postgres-data:
```

```sql
-- docker/postgres/init.sql
CREATE DATABASE url_shortener_test OWNER url_shortener;
```

- `npm run db:up` = `docker compose up -d --wait`, which returns once the healthcheck passes.
- Scripts in `/docker-entrypoint-initdb.d` run **only when the data volume is empty**
  (first start). If you add the test DB later, run `docker compose down -v` (destroys data)
  or create it manually.

---

## 8. Step 3 — Configuration

### Laravel

`.env` → `config/*.php` → `config('app.frontend_url')`, read anywhere through the helper.
A missing variable becomes `null` and fails later.

### Express

```ts
// src/config/env.ts (abridged)
import "dotenv/config";
import { z } from "zod";

// Empty strings in .env mean "not set"
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8001),
  APP_URL: z.url().default("http://localhost:8001"),
  FRONTEND_URL: z.url().default("http://localhost:3000"),
  CORS_ALLOWED_ORIGINS: optional(z.string()),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.string().min(1),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  TOKEN_EXPIRATION_MINUTES: optional(z.coerce.number().int().positive()),
  MAIL_MAILER: z.enum(["smtp", "log"]).default("log"),
  // MAIL_HOST, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD, MAIL_FROM_ADDRESS, MAIL_FROM_NAME …
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast: a misconfigured app should not start
  console.error("Invalid environment variables:", z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === "production",
  port: env.PORT,
  appUrl: env.APP_URL.replace(/\/$/, ""),
  frontendUrl: env.FRONTEND_URL.replace(/\/$/, ""),
  corsOrigins: (env.CORS_ALLOWED_ORIGINS ?? env.FRONTEND_URL).split(",").map((o) => o.trim()),
  auth: { bcryptRounds: env.BCRYPT_ROUNDS, tokenExpirationMinutes: env.TOKEN_EXPIRATION_MINUTES ?? null },
  mail: { /* … */ },
} as const;

export type AppConfig = typeof config;
```

Best practices:
- **Validate at boot.** Wrong types (e.g. `PORT=abc`) and missing values stop the process
  with a clear message (12-factor "config in the environment" + fail fast).
- **Read `process.env` in exactly one file.** Everything else receives `config` (or a slice
  of it) by injection, so tests can override values.
- **Typed config.** `AppConfig` is inferred; `config.mail.port` is a `number`.
- `.env.example` is committed; `.env` is not. `.env.test` (no secrets) is committed for tests.

| Laravel `.env` | Express `.env` |
|---|---|
| `APP_ENV=local` | `NODE_ENV=development` |
| `APP_URL` | `APP_URL` (used for `short_url` links) |
| `DB_CONNECTION/HOST/PORT/DATABASE/USERNAME/PASSWORD` | `DATABASE_URL=postgresql://user:pass@host:5432/db?schema=public` |
| `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS` | same names |
| `BCRYPT_ROUNDS` | same |
| `config/sanctum.php` `expiration` | `TOKEN_EXPIRATION_MINUTES` |
| `MAIL_*` | same names (`MAIL_MAILER=log` or `smtp`) |

---

## 9. Step 4 — Migrations → Prisma schema

### Laravel

```php
Schema::create('users', function (Blueprint $table) {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->string('name');
    $table->string('email')->unique();
    $table->string('password')->nullable()->default(null);
    $table->enum('type', ['superadmin', 'admin', 'member'])->default('admin');
    $table->enum('status', ['pending', 'enabled'])->default('pending');
    $table->integer('total_urls')->default(0);
    $table->integer('total_url_hits')->default(0);
    $table->timestamps();
});
```

### Prisma

```prisma
// prisma/schema.prisma (excerpt)
generator client {
  provider               = "prisma-client"
  output                 = "../src/generated/prisma"
  moduleFormat           = "esm"
  runtime                = "nodejs"
  generatedFileExtension = "ts"
  importFileExtension    = "js"
}

datasource db {
  provider = "postgresql"
}

enum UserType {
  superadmin
  admin
  member

  @@map("user_type")
}

model User {
  id           Int        @id @default(autoincrement())
  companyId    Int        @map("company_id")
  name         String     @db.VarChar(255)
  email        String     @unique @db.VarChar(255)
  password     String?    @db.VarChar(255)
  type         UserType   @default(admin)
  status       UserStatus @default(pending)
  totalUrls    Int        @default(0) @map("total_urls")
  totalUrlHits Int        @default(0) @map("total_url_hits")
  createdAt    DateTime   @default(now()) @map("created_at")
  updatedAt    DateTime   @updatedAt @map("updated_at")

  company      Company               @relation(fields: [companyId], references: [id], onDelete: Cascade)
  shortUrls    ShortUrl[]
  accessTokens PersonalAccessToken[]

  @@index([companyId])
  @@map("users")
}

model ShortUrl {
  id           Int      @id @default(autoincrement())
  companyId    Int      @map("company_id")
  url          String
  // Unique + indexed: every redirect looks the link up by code
  shortUrlCode String   @unique @map("short_url_code") @db.VarChar(20)
  hits         Int      @default(0)
  createdBy    Int      @map("created_by")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  creator User    @relation(fields: [createdBy], references: [id], onDelete: Cascade)

  @@index([companyId, createdAt])
  @@index([createdBy])
  @@index([createdAt])
  @@map("short_urls")
}
```

Then:

```bash
npx prisma migrate dev --name init   # diff schema → SQL migration → apply to dev DB
npx prisma generate                  # (re)generate the typed client
```

Generated SQL (excerpt):

```sql
CREATE TYPE "user_type" AS ENUM ('superadmin', 'admin', 'member');

CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "type" "user_type" NOT NULL DEFAULT 'admin',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ...
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
```

### Translation table

| Laravel Blueprint | Prisma |
|---|---|
| `$table->id()` | `id Int @id @default(autoincrement())` |
| `foreignId('company_id')->constrained()->cascadeOnDelete()` | scalar `companyId Int @map("company_id")` + `@relation(..., onDelete: Cascade)` |
| `string('x')` | `String @db.VarChar(255)` (Postgres `text` has no length cost; `VarChar` documents intent) |
| `->nullable()` | `String?` |
| `->unique()` | `@unique` |
| `enum('type', [...])` | `enum UserType {...}` → native Postgres enum type |
| `boolean('is_global')` | `Boolean` (real `boolean`, not MySQL `tinyint(1)`) |
| `timestamps()` | `createdAt @default(now())` + `updatedAt @updatedAt` |
| index | `@@index([...])` |
| table name | `@@map("users")`; column names via `@map("snake_case")` |

**Naming convention:** models and fields are **camelCase in TypeScript** and **snake_case in
Postgres** (`@map`/`@@map`), the idiomatic convention for each side. The API keeps
Laravel's snake_case through resources (§17).

**Improvements made while porting the schema:**
- `short_url_code` got a **unique index**. Laravel had none, so every redirect did a full
  table scan and duplicate codes were possible.
- Composite index `(company_id, created_at)` for the main list query (filter by company, sort
  by date).
- `url` is `text` (Laravel's `string` = 255 chars truncated long URLs).
- `invite_code` is unique (nullable unique is allowed in Postgres: multiple `NULL`s are fine).

**Prisma 7 specifics:**
- The `prisma-client` generator **requires an `output` path**; the client is generated into
  `src/generated/prisma` (git-ignored, recreated by `postinstall`).
- The DB URL lives in **`prisma.config.ts`**, not in `schema.prisma`:

```ts
// prisma.config.ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

- `migrate dev` no longer auto-runs `generate` or the seed; run `prisma generate` /
  `prisma db seed` explicitly.

---

## 10. Step 5 — Eloquent → Prisma Client + repositories

### The client (singleton)

```ts
// src/lib/prisma.ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { config } from "../config/env.js";

// One client (and connection pool) per process
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: config.databaseUrl }),
});
```

### Query translation

| Eloquent | Prisma |
|---|---|
| `User::where('email', $e)->first()` | `prisma.user.findUnique({ where: { email } })` |
| `User::findOrFail($id)` | `findUniqueOrThrow({ where: { id } })` |
| `->with('company:id,name')` | `include: { company: { select: { id: true, name: true } } }` |
| `->select('id', 'name')` | `select: { id: true, name: true }` |
| `->where('is_global', 0)->paginate($n)` | `findMany({ where, skip, take })` + `count({ where })` |
| `->orderBy('created_at', 'desc')` | `orderBy: { createdAt: "desc" }` |
| `->whereBetween('created_at', [$a, $b])` | `where: { createdAt: { gte: a, lte: b } }` |
| `->increment('hits')` | `update({ data: { hits: { increment: 1 } } })` (atomic `SET hits = hits + 1`) |
| `Model::updateOrCreate([...], [...])` | `upsert({ where, create, update })` |
| `->count()` | `count({ where })` |
| `DB::transaction(fn)` | `prisma.$transaction(async (tx) => …)` |
| `DB::statement(...)` | `` prisma.$executeRaw`...` `` (tagged template, parameters are escaped) |
| `$model->save()` (active record) | Explicit `create` / `update` calls (data mapper) |

> **Active Record vs Data Mapper.** Eloquent objects know how to save themselves
> (`$user->save()`). Prisma returns **plain objects**; persistence goes through the client.
> That's why a repository layer feels natural with Prisma.

### Joins became relations

```php
// Laravel: manual joins
ShortUrl::select('short_urls.id', ..., 'users.name as user', 'companies.id as client_id', ...)
    ->join('users', 'users.id', '=', 'short_urls.created_by')
    ->join('companies', 'companies.id', '=', 'users.company_id')
    ->where('short_urls.company_id', $user->company_id)
```

```ts
// Prisma: typed nested includes, flattened later by a resource
const listInclude = {
  creator: { select: { name: true, company: { select: { id: true, name: true } } } },
} as const;

export type ShortUrlListItem = Prisma.ShortUrlGetPayload<{ include: typeof listInclude }>;
```

`ShortUrlGetPayload` derives the **exact result type** from the query shape: rename a
field and the resource mapper fails to compile.

### Repository

```ts
// src/database/repositories/short-url.repository.ts (abridged)
export interface ShortUrlFilter {
  companyId?: number;
  createdBy?: number;
  createdAt?: { gte: Date; lte: Date };
}

// Newest first; id breaks ties so pages never overlap
const listOrder: Prisma.ShortUrlOrderByWithRelationInput[] = [{ createdAt: "desc" }, { id: "desc" }];

export class ShortUrlRepository {
  constructor(private readonly db: DbClient) {}

  async paginate(filter: ShortUrlFilter, { skip, take }: PageRequest) {
    const where = toWhere(filter);
    const [items, total] = await Promise.all([
      this.db.shortUrl.findMany({ where, include: listInclude, orderBy: listOrder, skip, take }),
      this.db.shortUrl.count({ where }),
    ]);
    return { items, total };
  }

  // Streams every matching row in batches (keyset pagination) for exports
  async *iterate(filter: ShortUrlFilter, batchSize = 1000): AsyncGenerator<ShortUrlListItem> {
    const where = toWhere(filter);
    let cursor: number | undefined;

    while (true) {
      const batch = await this.db.shortUrl.findMany({
        where, include: listInclude, orderBy: listOrder, take: batchSize,
        ...(cursor !== undefined && { cursor: { id: cursor }, skip: 1 }),
      });
      yield* batch;
      if (batch.length < batchSize) return;
      cursor = batch[batch.length - 1]!.id;
    }
  }

  incrementHits(id: number) {
    return this.db.shortUrl.update({ where: { id }, data: { hits: { increment: 1 } } });
  }
  // findByCode, create, countByCompany, countByCreator …
}
```

`DbClient` is `PrismaClient | Prisma.TransactionClient`, so the **same repository class**
works inside or outside a transaction.

### Unit of Work (transactions)

```ts
// src/database/unit-of-work.ts
export const createRepositories = (db: DbClient) => ({
  accessTokens: new AccessTokenRepository(db),
  companies: new CompanyRepository(db),
  invitations: new InvitationRepository(db),
  shortUrls: new ShortUrlRepository(db),
  users: new UserRepository(db),
});

export type Repositories = ReturnType<typeof createRepositories>;

// Runs several repository calls atomically (DB::transaction)
export class UnitOfWork {
  constructor(private readonly prisma: PrismaClient) {}

  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => work(createRepositories(tx)));
  }
}
```

Usage in a service:

```ts
await this.uow.run(async (repos) => {
  await repos.shortUrls.incrementHits(shortUrl.id);
  await repos.companies.incrementUrlHits(shortUrl.companyId);
  await repos.users.incrementUrlHits(shortUrl.createdBy);
});
```

The Laravel app ran these related writes **without** a transaction (registration created a
company, user and updated counters in separate statements). A crash midway left
inconsistent data. All multi-write operations now run in a transaction.

---

## 11. Step 6 — Seeders and factories

### Laravel

```php
// database/factories/ShortUrlFactory.php
return [
    'url' => fake()->url(),
    'short_url_code' => Str::random(6),
    'hits' => fake()->numberBetween(0, 1000),
    'created_at' => fake()->dateTimeBetween('-30 days', 'now'),
];
```

### Express

```ts
// prisma/factories.ts (excerpt)
export const shortUrlFactory = (
  overrides: Pick<Prisma.ShortUrlCreateManyInput, "companyId" | "createdBy">,
): Prisma.ShortUrlCreateManyInput => ({
  url: `${faker.internet.url({ appendSlash: false })}/${faker.lorem.slug()}.html`,
  shortUrlCode: unique(usedCodes, () => randomString(6)),
  hits: faker.number.int({ min: 0, max: 1000 }),
  createdAt: faker.date.recent({ days: 30 }),
  updatedAt: faker.date.recent({ days: 30 }),
  ...overrides,
});
```

`prisma/seed.ts` ports the three seeders (`CompanySeeder`, `ClientSeeder`,
`ShortUrlsSeeder`) with the same data shape (global "Sembark" company + superadmin; in
non-production: "Demo Company", admin/member users, 200 random companies, ~2–3k URLs).

Notable changes:

| Laravel | Express | Why |
|---|---|---|
| `Schema::disableForeignKeyConstraints(); DB::table(...)->truncate()` | `TRUNCATE … RESTART IDENTITY CASCADE` | Postgres truncates related tables together and resets sequences in one statement |
| `Model::factory()->count(50)->create()` (one INSERT per row) | `createMany({ data: [...] })` | Batched inserts, much faster |
| Loop over every company/user calling `->update()` to recalc totals | Two set-based `UPDATE … FROM (SELECT … GROUP BY …)` | Thousands of queries → two |
| `fake()->unique()` | small `unique()` helper with a `Set` | Faker v10 removed `unique` |
| `env('APP_ENV') === 'local'` | `!config.isProduction` | Uses the validated config |

```ts
// Recalculate the denormalized counters in two set-based queries
await prisma.$executeRaw`
  UPDATE users u SET
    total_urls     = COALESCE(s.urls, 0),
    total_url_hits = COALESCE(s.hits, 0)
  FROM users u2
  LEFT JOIN (SELECT created_by, COUNT(*) AS urls, SUM(hits) AS hits FROM short_urls GROUP BY created_by) s
    ON s.created_by = u2.id
  WHERE u.id = u2.id`;
```

---

## 12. Step 7 — Bootstrapping

### `server.ts` (process concerns): replaces `public/index.php`

```ts
// src/server.ts
const container = createContainer({ config, prisma, logger });
const app = createApp(container);

const server = app.listen(config.port, () => {
  logger.info(`API listening on ${config.appUrl} (port ${config.port}, ${config.env})`);
});

// Finish in-flight requests, then release the database pool
const shutdown = (signal: string) => {
  logger.info(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  // Force exit if connections don't drain in time
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

PHP-FPM starts a fresh process state per request, so Laravel never needs this. A Node server
is long-lived; orchestrators (Docker, Kubernetes, PM2) send `SIGTERM` on deploy, and
**graceful shutdown** prevents dropped requests and leaked DB connections.

### `app.ts` (HTTP concerns): replaces `bootstrap/app.php`

```ts
// src/app.ts
export const createApp = (container: Container) => {
  const { config, logger } = container;
  const app = express();

  app.set("trust proxy", config.trustProxy);

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins, exposedHeaders: ["Content-Disposition"] }));
  if (!config.isTest) {
    app.use(pinoHttp({ logger }));
  }
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: false }));

  app.use("/api", apiRoutes(container));
  app.use(webRoutes(container));

  app.use(notFoundHandler);
  app.use(errorHandler(logger, !config.isProduction));

  return app;
};
```

Splitting `createApp` (no `listen`) from `server.ts` lets tests call
`request(createApp(container))` with Supertest: no port, no global state.

### `container.ts`: the composition root

```ts
// src/container.ts (abridged)
export const createContainer = ({ config, prisma, logger, mailer }: ContainerDeps) => {
  const repos = createRepositories(prisma);
  const uow = new UnitOfWork(prisma);
  const hasher = new PasswordHasher(config.auth.bcryptRounds);
  const accessTokens = new AccessTokenService(repos.accessTokens, config.auth.tokenExpirationMinutes);

  const invitationService = new InvitationService(
    repos, uow, hasher, mailer ?? createMailer(config.mail, logger), config.frontendUrl,
  );
  const shortUrlService = new ShortUrlService(repos, uow, config.appUrl);

  return {
    config, prisma, logger, accessTokens,
    controllers: {
      auth: new AuthController(new AuthService(repos, hasher, accessTokens)),
      invitations: new InvitationController(invitationService),
      clients: new ClientController(new ClientService(repos, invitationService)),
      teamMembers: new TeamMemberController(new TeamMemberService(repos, invitationService)),
      shortUrls: new ShortUrlController(shortUrlService),
      redirect: new RedirectController(shortUrlService),
    },
  };
};
```

Laravel resolves `ShortUrlsController` and its type-hinted dependencies automatically through
reflection. Here the wiring is **explicit and type-checked**. A DI library (tsyringe,
Awilix, InversifyJS) can automate it in big apps, but a hand-written root is the simplest
correct option for this size.

---

## 13. Step 8 — Routes

### Laravel

```php
// routes/api.php
Route::post('/login', [AuthController::class, 'login']);
Route::middleware('auth:sanctum')->post('/logout', [AuthController::class, 'logout']);
Route::middleware('auth:sanctum')->post('/user', [AuthController::class, 'user']);

Route::post('/invitation/{code}/register', [InvitationController::class, 'register']);
Route::post('/invitation/{code}', [InvitationController::class, 'invitation']);

Route::prefix('superadmin')->middleware('auth:sanctum')->group(function () {
    Route::post('/clients/invite', [ClientsController::class, 'invite']);
    Route::post('/clients', [ClientsController::class, 'index']);
    Route::post('/urls/download', [ShortUrlsController::class, 'download']);
    Route::post('/urls', [ShortUrlsController::class, 'index']);
});

Route::prefix('admin')->middleware('auth:sanctum')->group(function () {
    Route::post('/team-members/invite', [TeamMembersController::class, 'invite']);
    Route::post('/team-members', [TeamMembersController::class, 'index']);
    Route::post('/urls/generate', [AdminShortUrlsController::class, 'generate']);
    Route::post('/urls/download', [AdminShortUrlsController::class, 'download']);
    Route::post('/urls', [AdminShortUrlsController::class, 'index']);
});
```

### Express

```ts
// src/routes/api.ts
export const apiRoutes = ({ controllers, accessTokens, config }: Container) => {
  const auth = authenticate(accessTokens);
  const loginLimiter = loginRateLimiter({ limit: 10, skip: config.isTest });

  return Router()
    .use(authRoutes(controllers.auth, { authenticate: auth, loginLimiter }))
    .use(invitationRoutes(controllers.invitations))
    .use(
      "/superadmin",
      auth,
      authorize("superadmin"),
      clientRoutes(controllers.clients),
      superadminShortUrlRoutes(controllers.shortUrls),
    )
    .use(
      "/admin",
      auth,
      teamMemberRoutes(controllers.teamMembers),
      companyShortUrlRoutes(controllers.shortUrls),
    );
};
```

Each module owns its routes:

```ts
// src/modules/auth/auth.routes.ts
export const authRoutes = (controller: AuthController, { authenticate, loginLimiter }: {...}) =>
  Router()
    .post("/login", loginLimiter, validate(loginSchema), controller.login)
    .post("/logout", authenticate, controller.logout)
    .post("/user", authenticate, controller.user);

// src/modules/short-urls/short-url.routes.ts
export const companyShortUrlRoutes = (controller: ShortUrlController) =>
  Router()
    .use("/urls", authorize("admin", "member"))
    .post("/urls/generate", validate(generateSchema), controller.generate)
    .post("/urls/download", validate(companyUrlsFilterSchema), controller.download)
    .post("/urls", validate(companyUrlsListSchema), controller.index);
```

```ts
// src/routes/web.ts
export const webRoutes = ({ controllers, prisma, config }: Container) =>
  Router()
    .get("/up", async (_req, res) => { /* SELECT 1 → { status: "ok" } or 503 */ })
    .get("/s/:code", controllers.redirect.redirect)
    .get("/", (_req, res) => res.redirect(config.frontendUrl));
```

| Laravel | Express |
|---|---|
| `{code}` | `:code` → `req.params.code` |
| `Route::prefix('x')->group()` | `router.use("/x", subRouter)` |
| `->middleware('auth:sanctum')` on a group | pass middleware before the sub-router in `use()` |
| `[Controller::class, 'method']` | `controller.method` (arrow function property, so `this` stays bound) |
| route caching / named routes | not built in; build URLs from config (`config.appUrl + "/s/" + code`) |
| order: specific before generic | same: `/urls/download` is registered before `/urls` (Express matches in order) |

> **Why arrow functions in controllers?** `router.post("/x", controller.login)` passes the
> method **detached** from its object. A normal method would lose `this`. Declaring
> handlers as `login = async (req, res) => {...}` binds `this` to the instance.

---

## 14. Step 9 — Middleware, authentication and authorization

### Sanctum personal access tokens, re-implemented

Sanctum issues `"<id>|<40 random chars>"`, stores **SHA-256(random)** in
`personal_access_tokens`, and on each request looks the row up by id and compares hashes.
The Express service reproduces this exactly, so both frontends' stored tokens behave the
same way:

```ts
// src/modules/auth/access-token.service.ts
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const safeEqual = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export class AccessTokenService {
  constructor(
    private readonly tokens: AccessTokenRepository,
    private readonly expirationMinutes: number | null,
  ) {}

  async issue(userId: number, name = "api-token") {
    const plain = randomString(40);
    const expiresAt = this.expirationMinutes
      ? new Date(Date.now() + this.expirationMinutes * 60_000)
      : null;

    const record = await this.tokens.create({ userId, name, token: sha256(plain), expiresAt });
    return `${record.id}|${plain}`;
  }

  async verify(bearer: string) {
    const separator = bearer.indexOf("|");
    const hasId = separator > 0;
    const plain = hasId ? bearer.slice(separator + 1) : bearer;
    const hash = sha256(plain);

    const record = hasId
      ? await this.tokens.findWithUser(Number(bearer.slice(0, separator)))
      : await this.tokens.findByHashWithUser(hash);

    if (!record || !safeEqual(record.token, hash)) return null;
    if (record.expiresAt && record.expiresAt <= new Date()) return null;

    await this.tokens.touch(record.id);

    const { user, ...accessToken } = record;
    return { user, accessToken };
  }

  async revoke(tokenId: number) {
    await this.tokens.delete(tokenId);
  }
}
```

Why this design (and why not JWT):
- **Revocable**: logout deletes the row; a stolen token stops working immediately. A
  stateless JWT stays valid until it expires unless you add a denylist.
- **Hashed at rest**: a database leak doesn't expose usable tokens.
- **Constant-time comparison** (`timingSafeEqual`) avoids timing side channels.
- **Compatible**: identical wire format to Sanctum.
- Cost: one indexed lookup per request (same as Sanctum).

### `auth:sanctum` → `authenticate`

```ts
// src/middlewares/authenticate.ts
export const authenticate =
  (accessTokens: AccessTokenService): RequestHandler =>
  async (req, _res, next) => {
    const header = req.headers.authorization ?? "";
    const [scheme, bearer] = header.split(" ");

    if (scheme?.toLowerCase() !== "bearer" || !bearer) {
      throw new UnauthenticatedError();
    }

    const result = await accessTokens.verify(bearer);
    if (!result) {
      throw new UnauthenticatedError();
    }

    req.auth = result;
    next();
  };
```

`req.auth` is typed through **declaration merging**:

```ts
// src/types/express.d.ts
declare global {
  namespace Express {
    interface Request {
      // Set by the authenticate middleware
      auth?: { user: User; accessToken: PersonalAccessToken };
    }
  }
}
```

### `FormRequest::authorize()` → `authorize(...roles)`

```php
// Laravel: in each FormRequest
public function authorize(): bool
{
    return $this->user()->type === 'admin' || $this->user()->type === 'member';
}
```

```ts
// src/middlewares/authorize.ts
export const authorize =
  (...allowed: UserType[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) throw new UnauthenticatedError();
    if (!allowed.includes(req.auth.user.type)) throw new ForbiddenError();
    next();
  };
```

Laravel had the role check copy-pasted into **every** FormRequest. Here it's declared once
per route group (`authorize("superadmin")` on `/superadmin`) or per sub-path
(`.use("/team-members", authorize("admin"))`). For finer rules (e.g. "can edit this
link"), add a **policy** function per resource, as Laravel Policies do.

Order matches Laravel: **authenticate (401) → authorize (403) → validate (422) → handler**.

### Throttling

```ts
// src/middlewares/rate-limit.ts
export const loginRateLimiter = (options: { limit: number; skip?: boolean }) =>
  rateLimit({
    windowMs: 60_000,
    limit: options.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // Only failed attempts count, so normal logins never lock anyone out
    skipSuccessfulRequests: true,
    skip: () => options.skip ?? false,
    handler: (_req, res) => sendError(res, "Too Many Attempts.", 429),
  });
```

The Laravel app had **no** login throttling, so passwords could be brute-forced. The
default store is in-memory (per process); with several instances use a shared store
(`rate-limit-redis`).

---

## 15. Step 10 — FormRequest validation → Zod

### The contract to preserve

Both frontends display `errors.<field>[0]` under each input, so the Express API must return
**the same shape and the same English messages** as Laravel:

```json
{ "status": false, "message": "Validation error",
  "errors": { "email": ["The email field must be a valid email address."] } }
```

### Rule builders that mimic Laravel

```ts
// src/validation/rules.ts (excerpt)
const label = (field: string) => field.replace(/_/g, " ");

// Laravel trims strings and converts "" to null before validating
const blankToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value ?? undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

/** required|string */
export const required = (field: string) =>
  z.preprocess(
    blankToUndefined,
    z.string({
      error: (issue) =>
        issue.input === undefined
          ? `The ${label(field)} field is required.`
          : `The ${label(field)} field must be a string.`,
    }),
  );

/** required|email */
export const requiredEmail = (field: string) =>
  required(field).pipe(z.email(`The ${label(field)} field must be a valid email address.`));

/** required|min:n */
export const requiredMin = (field: string, min: number) =>
  required(field).pipe(
    z.string().min(min, `The ${label(field)} field must be at least ${min} characters.`),
  );

/** required|in:a,b */
export const requiredIn = <const T extends readonly [string, ...string[]]>(field: string, values: T) =>
  required(field).pipe(z.enum(values, { error: `The selected ${label(field)} is invalid.` }));

// Collects zod issues into Laravel's { field: [messages] } shape
export const toValidationErrors = (error: z.ZodError) => {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (errors[key] ??= []).push(issue.message);
  }
  return errors;
};
```

`blankToUndefined` reproduces two **global Laravel middleware** many people forget exist:
`TrimStrings` and `ConvertEmptyStringsToNull`. Without it, `"   "` would pass `required`.

### FormRequest → schema

```php
// RegisterRequest::rules()
$rules = [
    'name'  => 'required',
    'email' => 'required|email|unique:users,email',
    'password' => 'required|min:8',
    'password_confirmation' => 'required|same:password'
];
if ($invitation && $invitation->company->is_global === 1) {
    $rules['company_name'] = 'required';
}
```

```ts
// src/modules/invitations/invitation.schema.ts
export const registerSchema = z
  .object({
    name: required("name"),
    email: requiredEmail("email"),
    company_name: z.string().trim().optional(),
    password: requiredMin("password", 8),
    password_confirmation: required("password_confirmation"),
  })
  // same:password — `when` makes it run even if other fields failed, so all
  // errors come back at once like Laravel
  .refine((data) => data.password_confirmation === data.password, {
    ...sameAs("password_confirmation", "password"),
    when: ({ value }) =>
      typeof (value as { password_confirmation?: unknown })?.password_confirmation === "string",
  });

export type RegisterInput = z.infer<typeof registerSchema>;
```

### The middleware

```ts
// src/middlewares/validate.ts
export const validate =
  (schema: z.ZodType): RequestHandler =>
  async (req, _res, next) => {
    const result = await schema.safeParseAsync(req.body ?? {});
    if (!result.success) {
      throw new ValidationError(toValidationErrors(result.error));
    }
    req.body = result.data;
    next();
  };
```

### Where each rule went

| Laravel rule | Express |
|---|---|
| `required`, `email`, `min`, `in`, `regex`, `same` | Zod schema (pure, synchronous, no I/O) |
| `unique:users,email` | **Service** (`InvitationService.assertEmailAvailable`) throwing a `ValidationError` with Laravel's message |
| `company_name` "required if invitation is global" | **Service** (needs the invitation from the DB) |
| `authorize()` | `authorize()` middleware |
| `prepareForValidation` / `TrimStrings` | `z.preprocess(blankToUndefined, …)` |
| Paginator reading `page` / `per_page` | `paginationSchema` with `.catch()` fallbacks (bad input → defaults, like Laravel) |

Keeping database checks out of schemas keeps schemas pure and fast. Business rules live
in services, which own the transaction (avoiding check-then-insert races).

**Typed bodies:** after `validate(schema)`, controllers use
`BodyRequest<z.infer<typeof schema>>`, so `req.body.email` is `string`, not `any`.

> **Zod gotcha:** object-level `.refine` / `.superRefine` is skipped when any field has
> errors. Laravel reports *all* failing rules at once, so the `same:password` check passes
> `when` to run whenever a confirmation was sent. Without it the frontend showed the
> confirmation error only after fixing every other field.

---

## 16. Step 11 — Controllers → controllers + services

Laravel controllers here did everything: querying, business rules, mail, response. In
Express they're split:

- **Controller**: read `req`, call a service, send the response. No database calls.
- **Service**: business rules, transactions, orchestration. No `req`/`res`, so it's reusable
  from a CLI, queue worker or test.

### Example: generate a short URL

```php
// Laravel: Admin\ShortUrlsController::generate
do {
    $code = Str::random(6);
} while (ShortUrl::where('short_url_code', $code)->exists());

$shortUrl = new ShortUrl();
$shortUrl->company_id = $user->company_id;
// ...
$shortUrl->save();

$userTotalUrls = ShortUrl::where('created_by', $user->id)->count();
$companyTotalUrls = ShortUrl::where('company_id', $user->company_id)->count();
Company::where('id', $user->company_id)->update(['total_urls' => $companyTotalUrls]);
User::where('id', $user->id)->update(['total_urls' => $userTotalUrls]);

return $this->success('Short URL generated successfully');
```

```ts
// src/modules/short-urls/short-url.controller.ts
generate = async (req: BodyRequest<GenerateInput>, res: Response) => {
  await this.shortUrls.generate(authUser(req), req.body.url);
  sendSuccess(res, "Short URL generated successfully");
};
```

```ts
// src/modules/short-urls/short-url.service.ts
const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

// Inserts with a random code; the unique index decides collisions, so two
// concurrent requests can never get the same code
async generate(user: User, url: string) {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    try {
      return await this.uow.run(async (repos) => {
        const shortUrl = await repos.shortUrls.create({
          companyId: user.companyId,
          createdBy: user.id,
          url,
          shortUrlCode: randomString(CODE_LENGTH),
        });

        // Recount (self-healing) like the Laravel controller did
        await repos.companies.update(user.companyId, {
          totalUrls: await repos.shortUrls.countByCompany(user.companyId),
        });
        await repos.users.update(user.id, {
          totalUrls: await repos.shortUrls.countByCreator(user.id),
        });

        return shortUrl;
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new HttpError(500, "Could not generate a unique short code. Please try again.");
}
```

What changed and why:
- **Check-then-insert race fixed.** Laravel's `exists()` loop could let two concurrent
  requests pick the same code. The unique index plus retry on `P2002` is race-free.
- **Retry wraps the whole transaction.** In Postgres a failed statement aborts the
  transaction, so the retry starts a new one.
- **Atomic.** The insert and counter updates commit together.

### Example: role-scoped listing

```ts
private companyFilter(user: User, filter: CompanyUrlsFilter): ShortUrlFilter {
  return {
    ...createdBetween(filter),
    companyId: user.companyId,
    createdBy: user.type === "member" ? user.id : undefined,
  };
}
```

Same rule as Laravel (`if ($user->type === 'member') $urls->where('created_by', $user->id)`),
but expressed once and shared by the list and the CSV export.

### Response envelope (ApiBaseController)

```ts
// src/utils/api-response.ts
// Same envelope as the Laravel ApiBaseController: { status, message, data | errors }
export const sendSuccess = (res: Response, message = "Success", data: unknown = [], status = 200) =>
  res.status(status).json({ status: true, message, data });

export const sendError = (res: Response, message = "Something went wrong", status = 400, errors = []) =>
  res.status(status).json({ status: false, message, errors });
```

`data` defaults to `[]` because that's what PHP's empty array serialized to.

---

## 17. Step 12 — API Resources

Laravel returned query results directly (`select(... 'users.name as user' ...)`), plus
`$appends = ['short_url']` and `$hidden = ['password']`. The Express app maps DB objects
to the API contract explicitly:

```ts
// src/modules/short-urls/short-url.resource.ts
export const shortLink = (appUrl: string, code: string) => `${appUrl}/s/${code}`;

// Admin/member list: shows who created the link
export const toCompanyShortUrlResource = (appUrl: string) => (url: ShortUrlListItem) => ({
  id: url.id,
  url: url.url,
  short_url_code: url.shortUrlCode,
  hits: url.hits,
  user: url.creator.name,
  client_id: url.creator.company.id,
  created_at: url.createdAt,
  short_url: shortLink(appUrl, url.shortUrlCode),
});
```

```ts
// src/modules/invitations/invitation.resource.ts
company: {
  id: invitation.company.id,
  name: invitation.company.name,
  // Laravel cast is_global to an integer; both frontends test truthiness
  is_global: invitation.company.isGlobal ? 1 : 0,
},
```

Why it's a best practice:
- **Allow-list, not deny-list.** Only listed fields leave the server. Adding a sensitive
  column later can't leak by accident (unlike `$hidden`, which you must remember to update).
- **Decoupling.** The DB can use `isGlobal: boolean` and camelCase while the API keeps
  `is_global: 1` and snake_case for existing clients.
- **Typed.** Resource input types come from Prisma payload types.

| Laravel output | Express output |
|---|---|
| `"created_at": "2026-10-07T17:08:42.000000Z"` | `"created_at": "2026-10-07T17:08:42.000Z"` (ISO 8601; both parse identically) |
| `"short_url": "http://localhost:8000/s/MgMdDb"` | `"short_url": "http://localhost:8001/s/MgMdDb"` (from `APP_URL`) |

---

## 18. Step 13 — Exception handler → error middleware

### Laravel

```php
->withExceptions(function (Exceptions $exceptions): void {
    $exceptions->render(function (AuthenticationException $e, Request $request) {
        if ($request->is('api/*')) {
            return response()->json(['status' => false, 'message' => 'Unauthenticated'], 401);
        }
    });
})
```

### Express: typed errors + one handler

```ts
// src/utils/http-error.ts
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors: ValidationErrors | [] = [],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnauthenticatedError extends HttpError {
  constructor(message = "Unauthenticated") { super(401, message); }
}
export class ForbiddenError extends HttpError {
  constructor(message = "This action is unauthorized.") { super(403, message); }
}
export class ValidationError extends HttpError {
  constructor(errors: ValidationErrors, message = "Validation error") { super(422, message, errors); }
}
// BadRequestError (400), NotFoundError (404)
```

```ts
// src/middlewares/error-handler.ts
export const notFoundHandler: RequestHandler = () => {
  throw new NotFoundError();
};

export const errorHandler =
  (logger: Logger, exposeErrors: boolean): ErrorRequestHandler =>
  (err, _req, res, next) => {
    // A streamed response (CSV) already started; let Express close the socket
    if (res.headersSent) return next(err);

    if (err instanceof HttpError) {
      return sendError(res, err.message, err.status, err.errors);
    }

    // body-parser errors (malformed JSON, payload too large)
    if (err?.type === "entity.parse.failed") {
      return sendError(res, "Malformed JSON in request body.", 400);
    }
    if (typeof err?.status === "number" && err.status < 500 && err.expose) {
      return sendError(res, err.message, err.status);
    }

    logger.error({ err }, "Unhandled error");
    return sendError(res, exposeErrors ? String(err?.message ?? err) : "Server Error", 500);
  };
```

- **Express 5 forwards async errors.** Throwing (or a rejected promise) inside an `async`
  handler reaches this middleware. Express 4 needed `try/catch` + `next(err)` or an
  `asyncHandler` wrapper.
- An error middleware is recognised by its **four parameters** `(err, req, res, next)`.
- Unknown errors are logged with a stack, but production responses say only `"Server Error"`,
  never internals (Laravel's `APP_DEBUG=false` behaviour). Laravel in debug mode returned
  full stack traces for 403s, which leaks file paths if left on in production.

---

## 19. Step 14 — Mail

### Strategy interface

```ts
// src/mail/mailer.ts
export interface MailMessage {
  to: string;
  subject: string;
  html: string;
}

// Strategy: the app depends on this interface, the transport is chosen by config
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export class SmtpMailer implements Mailer { /* nodemailer.createTransport(...).sendMail(...) */ }

// MAIL_MAILER=log: write emails to the log instead of sending them
export class LogMailer implements Mailer {
  constructor(private readonly logger: Logger) {}
  async send(message: MailMessage) {
    this.logger.info({ mail: message }, `Mail to ${message.to}: ${message.subject}`);
  }
}

export const createMailer = (mailConfig: AppConfig["mail"], logger: Logger): Mailer =>
  mailConfig.mailer === "smtp" ? new SmtpMailer(mailConfig) : new LogMailer(logger);
```

Tests inject a `FakeMailer` that records messages (Laravel's `Mail::fake()`).

### Mailable + Blade → template functions

```ts
// src/mail/templates/invitations.ts
// App\Mail\InviteMailClient + emails/invite_client.blade.php
export const inviteClientMail = ({ name, company, inviteLink }: InvitationMailData) => ({
  subject: `Invitation mail from ${company}`,
  html: invitationLayout(name, "You have been invited to join our platform.", inviteLink),
});
```

The layout escapes every interpolated value with `escapeHtml()`, the equivalent of Blade's
`{{ }}`. Template literals do **not** escape automatically, so forgetting it is an XSS bug.
For many templates use a real engine (Handlebars, EJS, MJML or React Email).

**Production tip:** sending mail inside the request makes the user wait on SMTP. Laravel
would `queue()` the Mailable; in Node use a job queue (**BullMQ** + Redis) and keep the
`Mailer` interface the same.

---

## 20. Step 15 — Excel exports → streamed CSV

Laravel loaded **every row** into memory (`->get()`), then let Laravel Excel write the file.
The Express version streams:

```ts
// src/modules/short-urls/short-url.service.ts
async *exportForUser(user: User, filter: CompanyUrlsFilter) {
  for await (const url of this.repos.shortUrls.iterate(this.companyFilter(user, filter))) {
    yield toCompanyExportRow(url);
  }
}
```

```ts
// src/utils/csv.ts
export const sendCsv = async (res: Response, fileName: string, headings: string[], rows: AsyncIterable<unknown[]>) => {
  res.setHeader("Content-Type", "text/csv; charset=UTF-8");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

  await pipeline(Readable.from(rows), stringify({ header: true, columns: headings, quoted: true }), res);
};
```

- **Constant memory:** rows are fetched in batches of 1,000 with **keyset (cursor)
  pagination**, which stays fast on deep pages (unlike `OFFSET`).
- **Back-pressure:** `stream.pipeline` pauses the DB reads when the client is slow, and
  cleans up on errors or client disconnects.
- **Same output:** `quoted: true`, same headings and `d M Y` dates. A test asserts the exact
  CSV lines.
- CORS exposes `Content-Disposition` so browsers can read the file name.

---

## 21. Step 16 — Testing

Laravel's default tests were the stock examples. The Express port ships **31 tests**:

```
tests/
├── setup/global-setup.ts         # prisma migrate deploy on the test DB, once per run
├── helpers.ts                    # app with FakeMailer, fixtures, login helper
├── integration/
│   ├── auth.test.ts              # login, token format, 403/422, /user, logout revokes, forged tokens
│   ├── authorization.test.ts     # role matrix (403s), 401 before 403
│   ├── short-urls.test.ts        # generate + totals, scoping, pagination, filters, CSV, redirect hits
│   └── invitations.test.ts       # client & team flows, single-use codes, duplicate email, mail failure
└── unit/utils.test.ts            # pagination, dates, random strings, HTML escaping
```

```ts
// vitest.config.ts
const testEnv = parse(readFileSync(".env.test"));

export default defineConfig({
  test: {
    env: testEnv,                           // DATABASE_URL → url_shortener_test
    globalSetup: ["tests/setup/global-setup.ts"],
    fileParallelism: false,                 // integration tests share one database
    include: ["tests/**/*.test.ts"],
  },
});
```

```ts
// tests/integration/short-urls.test.ts (excerpt)
it("redirects and counts the hit for the link, company and creator", async () => {
  const res = await api().get("/s/BBBBBB");

  expect(res.status).toBe(302);
  expect(res.headers.location).toBe("https://b.example.com");
  expect((await prisma.shortUrl.findUniqueOrThrow({ where: { shortUrlCode: "BBBBBB" } })).hits).toBe(1);
  expect((await prisma.company.findUniqueOrThrow({ where: { id: f.client.id } })).totalUrlHits).toBe(1);

  await api().get("/s/nope00").expect(404);
});
```

| Laravel testing | Express testing |
|---|---|
| `RefreshDatabase` | `TRUNCATE … RESTART IDENTITY CASCADE` in `beforeEach` |
| `$this->postJson('/api/login', [...])` | `request(app).post("/api/login").send({...})` |
| `Mail::fake()` + `Mail::assertSent` | Inject `FakeMailer`, inspect `mailer.sent` |
| `actingAs($user, 'sanctum')` | Log in and send `Authorization: Bearer …` |
| `.env.testing` | `.env.test` loaded by `vitest.config.ts` |

Integration tests use **real PostgreSQL** rather than mocks, so SQL, constraints and
transactions are exercised as in production.

---

## 22. MySQL → PostgreSQL differences

| Topic | MySQL (Laravel app) | PostgreSQL (Express app) |
|---|---|---|
| Booleans | `tinyint(1)` → `0/1` | real `boolean` → `true/false` (mapped back to `0/1` in the resource) |
| Enums | inline `ENUM(...)` column | named type `CREATE TYPE user_type AS ENUM (...)` |
| Auto increment | `AUTO_INCREMENT` | `SERIAL` / identity sequences; `TRUNCATE … RESTART IDENTITY` |
| Ambiguous `ORDER BY created_at` with joins | tolerated (resolves against the select list) | **error** ("column reference is ambiguous"). Prisma always qualifies |
| String comparison | case-insensitive by default collation | **case-sensitive**; use `mode: "insensitive"` / `citext` / `lower()` index for emails |
| Type strictness | `WHERE id = 'abc'` coerces | type error; validate inputs (`optionalInteger("company_id")`) |
| Failed statement in a transaction | transaction continues | transaction is **aborted** until rollback, so retries must restart the transaction |
| `GROUP BY` | lax (non-aggregated columns allowed) | strict SQL standard |
| Timestamps | `TIMESTAMP` | `TIMESTAMP(3)` (ms precision) via Prisma; use `timestamptz` if you store local times |
| Upsert | `INSERT … ON DUPLICATE KEY UPDATE` | `INSERT … ON CONFLICT … DO UPDATE` (Prisma `upsert`) |
| JSON | `JSON` | `jsonb` (indexable with GIN) |
| Unique + NULL | multiple NULLs allowed | multiple NULLs allowed (`NULLS NOT DISTINCT` to forbid) |

> **Emails and case:** Postgres compares `Admin@Example.com` ≠ `admin@example.com`. Laravel on
> MySQL treated them as equal. Normalise to lower-case on write (the seed does) or use a
> `citext` column / unique index on `lower(email)` in production.

---

## 23. Bugs fixed and behaviour changes

| # | Laravel behaviour | Express behaviour |
|---|---|---|
| 1 | `short_url_code` not unique or indexed; full scan per redirect; duplicates possible | Unique index; insert-and-retry on conflict |
| 2 | Code uniqueness checked before insert (race) | Database enforces it |
| 3 | Multi-step writes (register, generate, redirect counters) not transactional | All in `UnitOfWork` transactions |
| 4 | Register used the **posted** email, so an invite code could register any address | Account is created for the **invited** email |
| 5 | Links saved as `www.example.com` redirected to `APP_URL/www.example.com` | Scheme added (`http://`) before redirecting |
| 6 | No login throttling | 10 failed attempts/min per IP |
| 7 | `per_page` unbounded (`per_page=1000000`) | Capped at 100 |
| 8 | Export loaded all rows in memory | Streamed in batches |
| 9 | `url` limited to 255 chars | `text` |
| 10 | Debug-mode 403s returned stack traces | Uniform `{ status:false, message, errors }`; internals hidden in production |
| 11 | Role checks duplicated in every FormRequest | One `authorize()` per route group |
| 12 | `orderBy('created_at')` ambiguous on non-MySQL databases | Explicit ordering + `id` tie-breaker (stable pagination) |

Unchanged on purpose: endpoints and methods (all `POST`), field names, messages, status codes
(including `403` for wrong credentials and mail failures), token format, CSV columns, and
`is_global` as `0/1`.

---

## 24. Security and production checklist

- [x] `helmet()` security headers; `x-powered-by` removed
- [x] CORS allow-list from config, not `*`
- [x] Body size limit (`100kb`)
- [x] Passwords hashed with bcrypt (cost from config); tokens stored as SHA-256; constant-time compare
- [x] Rate-limited login
- [x] Input validated at the edge; DB access only through parameterised Prisma queries / tagged `$executeRaw`
- [x] Allow-listed response fields (resources)
- [x] Authorization logs/redaction: `authorization` and `cookie` headers redacted by Pino
- [x] Generic 500 messages in production; errors logged with stack
- [x] Fail-fast env validation
- [x] Graceful shutdown on `SIGTERM`/`SIGINT`
- [x] Health endpoint with DB check (`/up`)
- [x] `trust proxy` configurable (correct client IPs for rate limiting behind a load balancer)
- [ ] Production extras: run `npm run db:deploy` in the release step, a process manager or
      container orchestration, a shared rate-limit store (Redis) for multiple instances, a
      queue for emails, HTTPS termination at the proxy, centralised log shipping

### Production run

```bash
npm ci
npm run build
npm run db:deploy          # never `migrate dev` in production
NODE_ENV=production node --enable-source-maps dist/server.js
```

---

## 25. Pitfalls hit during the migration

| Problem | Cause | Fix |
|---|---|---|
| `npm view prisma version` showed `8.0.0-rc.21` | `latest` dist-tag pointed at a release candidate | Pin `prisma@7.10.0` / `@prisma/client@7.10.0` / `@prisma/adapter-pg@7.10.0` |
| `prisma init` created `.claude/`, `.agents/`, `.windsurf/`, `skills-lock.json`, `prisma7.config.ts` | Prisma 7 CLI scaffolds AI-agent skills | Deleted; config renamed to `prisma.config.ts` |
| `migrate dev` didn't seed | Prisma 7 removed automatic seeding/generation | `prisma db seed` / `prisma generate` explicitly |
| `TS2345 … 'unknown' is not assignable to 'ParamsDictionary'` | `Request<unknown, …>` generics | `BodyRequest<T>` helper type |
| Missing "password confirmation must match" when other fields failed | Zod skips object refinements after field errors | `.refine(..., { when })` |
| Login suddenly returned 401s during manual testing | New login limiter counted successful logins | `skipSuccessfulRequests: true` |
| `"   "` passed `required` | Laravel's `TrimStrings` / `ConvertEmptyStringsToNull` aren't in Express | `blankToUndefined` preprocessing |
| Retries after a duplicate code failed with "current transaction is aborted" | Postgres aborts the transaction after an error | Retry the whole `uow.run()` |
| Imports failing at runtime with `ERR_MODULE_NOT_FOUND` | Node ESM needs file extensions | `.js` extensions in relative imports; Prisma `importFileExtension = "js"` |
| Malformed JSON error leaked parser internals | body-parser message | Mapped to "Malformed JSON in request body." |

---

## 26. Interview questions and answers

### Node.js and Express fundamentals

**1. How does Node.js handle concurrency if it's single-threaded?**
JavaScript runs on one thread with an **event loop**. I/O (network, DB, files) is
delegated to the OS or libuv's thread pool; callbacks/promises resume on the main thread
when results arrive. One process can serve thousands of concurrent I/O-bound requests. CPU-
bound work blocks everyone, so offload it to worker threads or other services.

**2. How is that different from PHP-FPM (Laravel)?**
PHP-FPM runs a pool of processes; each handles **one request at a time** and starts with
fresh state (share-nothing). Node keeps one long-lived process with shared memory, pooled
connections and no per-request bootstrap. That's faster, but you must avoid per-request data
in module scope and must shut down gracefully.

**3. What is middleware in Express and how does ordering work?**
Functions `(req, res, next)` executed in registration order. Each can end the response,
call `next()` to continue, or throw/`next(err)` to jump to error middleware. Order
matters: body parsers before validation, `authenticate` before `authorize`, the 404
handler after all routes, the error handler last.

**4. How do you write error-handling middleware?**
A function with **four** parameters `(err, req, res, next)`, registered after routes. Express 5
forwards rejected promises from `async` handlers automatically; Express 4 needed
`next(err)` or an `asyncHandler` wrapper.

**5. What changed in Express 5?**
Native promise support in handlers (errors go to error middleware), removal of deprecated
APIs (`res.send(status)`, `req.param()`), a stricter path-to-regexp syntax (named wildcards like
`/*splat`), `req.query` is a getter (no reassignment), `req.body` is `undefined` when no body
parser ran, and Node 18+ is required.

**6. `app.use` vs `app.get`/`router.post`?**
`use` mounts middleware or routers for a **path prefix** and all methods. `get`/`post` match an
exact path and method. In this project `.use("/superadmin", auth, authorize("superadmin"), router)`
protects every route under the prefix.

**7. How do you structure a large Express app?**
Feature modules (routes/controller/service/schema/resource per domain), shared
infrastructure (config, db, logger, middlewares), a composition root for dependency injection,
an `app` factory separate from `server` startup, and typed errors with a central handler.
Alternatively, adopt an opinionated framework built on Express (NestJS) when you want
Laravel-like conventions out of the box.

**8. Why separate `app.ts` and `server.ts`?**
So the app can be created without binding a port: tests use Supertest against the app, and
the same app can run under different servers (HTTP, HTTPS, serverless adapters). `server.ts`
owns process concerns: `listen`, signals, shutdown.

**9. How do you implement graceful shutdown?**
On `SIGTERM`/`SIGINT`: stop accepting connections (`server.close`), let in-flight requests
finish, close resources (`prisma.$disconnect()`), exit, and force-exit after a timeout.

**10. What's the difference between `process.on('unhandledRejection')` and the Express error handler?**
The error handler covers errors raised during request handling. `unhandledRejection`
catches promises nobody awaited anywhere (background tasks, fire-and-forget code). Log it, and
in many setups crash and let the process manager restart, since state may be inconsistent.

### Architecture and design patterns

**11. Why have services and repositories instead of querying in controllers?**
Separation of concerns: controllers handle HTTP, services hold business rules (reusable from
jobs/CLI, unit-testable), repositories encapsulate persistence (swap ORM, add caching,
consistent queries). It also keeps transactions in one layer.

**12. What is a composition root and how does it relate to Laravel's container?**
The single place where the object graph is assembled and dependencies injected
(`createContainer`). Laravel's container does this automatically with reflection and
bindings; in Express you either wire explicitly (type-safe, simple) or use a DI library
(tsyringe, Awilix, InversifyJS).

**13. Explain the Unit of Work pattern here.**
`UnitOfWork.run(fn)` opens a database transaction and gives `fn` repositories bound to that
transaction client. Everything in `fn` commits or rolls back together, without services
knowing about Prisma transaction APIs.

**14. Where else is the Strategy pattern useful?**
Anything with interchangeable implementations chosen by config: mail transports, storage
drivers (local/S3), cache stores, payment gateways. Laravel's "drivers" (mail, filesystem,
cache) are this pattern.

**15. Why map DB models to resources instead of returning them?**
An allow-list prevents accidental leaks of new columns, decouples API naming from DB naming,
lets you version the API independently, and documents the contract in code.

### Data layer (Prisma and PostgreSQL)

**16. Prisma vs Eloquent?**
Eloquent is Active Record (models save themselves, magic attributes, lazy relations). Prisma
is a schema-first query builder / data mapper: typed plain objects, explicit
`include`/`select`, no lazy loading (no accidental N+1 through property access),
migrations generated from schema diffs. Other Node options: Drizzle (SQL-like, lightweight),
TypeORM / MikroORM (Data Mapper + Unit of Work), Knex/Kysely (query builders), Sequelize
(Active Record, older).

**17. `migrate dev` vs `migrate deploy`?**
`dev` diffs the schema, generates a new migration, applies it to the dev DB, and may reset it
on drift. `deploy` only applies pending committed migrations, never generates or resets. It
is the only one to run in CI and production.

**18. How do you avoid N+1 queries with Prisma?**
Fetch relations in the same query with `include`/`select` (Prisma batches them); avoid
querying inside loops; use `findMany` with `in` filters; for aggregates use
`groupBy`/`_count` or raw SQL. Same as eager loading with `with()` in Eloquent.

**19. Offset vs keyset (cursor) pagination?**
`OFFSET n` scans and discards n rows, so it gets slower on deep pages and can skip or duplicate
rows when data changes. Keyset (`WHERE id < last_id ORDER BY id DESC LIMIT k` / Prisma `cursor`)
uses an index and stays fast; it's used here for exports. Offset is kept for the UI because
it needs page numbers.

**20. How do you handle race conditions like unique short codes?**
Let the database enforce invariants (unique index), attempt the insert, and retry on
unique-violation (`P2002`) instead of check-then-insert. For counters use atomic updates
(`increment`) rather than read-modify-write.

**21. Why connection pooling, and what's the risk in Node?**
Opening a DB connection per request is slow. A pool reuses connections. In Node, create **one**
client per process. Creating clients per request (or per hot-reload in dev) exhausts DB
connections. With many instances or serverless, add an external pooler (PgBouncer).

**22. Key MySQL → PostgreSQL gotchas?**
Case-sensitive string comparison, strict typing and `GROUP BY`, aborted transactions after an
error, native `boolean`/`enum`/`jsonb`, sequences for IDs (`RESTART IDENTITY`),
`ON CONFLICT` upserts, and ambiguous column errors that MySQL tolerated.

### Security and auth

**23. Opaque tokens vs JWT?**
Opaque tokens (Sanctum-style) are random strings looked up in the DB: revocable instantly,
tiny, but one DB/cache lookup per request. JWTs are self-contained signed claims: no lookup,
good across services, but hard to revoke (short expiry + refresh tokens or denylist) and
larger. For a first-party SPA + single API, opaque tokens or httpOnly session cookies are
simpler and safer.

**24. Why hash access tokens in the database?**
If the database leaks, attackers can't use the stored values. Only the client ever holds the
plain token (shown once). A fast hash (SHA-256) is enough because tokens are long random
strings; passwords need slow hashes (bcrypt/argon2) because they're guessable.

**25. Where should the frontend store the token?**
`localStorage` (this app) is simple but readable by any XSS. An **httpOnly, Secure,
SameSite** cookie isn't readable by JS and enables server-side route protection, but needs CSRF
protection (SameSite + CSRF token). Sanctum's SPA mode uses cookies for this reason.

**26. How do you prevent brute force and abuse?**
Rate limiting (per IP and per account), generic error messages, slow password hashing, account
lockout or CAPTCHA after repeated failures, request size limits, and monitoring.

**27. What does `helmet` do and is it enough?**
It sets security headers (CSP, HSTS, `X-Content-Type-Options`, frame options, referrer policy…).
It's one layer: you still need input validation, output encoding, authN/authZ, dependency
updates and secure config.

**28. Why `trust proxy`?**
Behind a load balancer, `req.ip` is the proxy's IP. `trust proxy = n` makes Express read the
client IP from `X-Forwarded-For` for the first *n* hops. It's needed for correct rate
limiting and logging, but trusting too many hops lets clients spoof IPs.

### Validation, testing, operations

**29. Why Zod (or similar) instead of manual checks?**
Declarative schemas, consistent error output, type inference (`z.infer`) so validation and
types never drift, and composability (`extend`, `pipe`, `refine`). Alternatives: Joi, Yup,
Valibot, class-validator (NestJS).

**30. Integration tests against a real DB or mocks?**
Real DB for repository/HTTP tests: constraints, transactions and SQL semantics are what
break in production. Mocks for pure units (services with fakes). Isolate with a dedicated test
database, truncation or transactions per test, and serial execution when sharing data.

**31. How do you stream large responses in Node?**
Produce data incrementally (async generators, DB cursors), pipe through transform streams
(CSV, gzip), and use `stream.pipeline` for back-pressure and cleanup. Never buffer the whole
result in memory.

**32. How would you run background jobs (Laravel queues) in Node?**
BullMQ (Redis-backed) for queues, retries, delays and scheduling; workers run as separate
processes. Cron-like jobs: BullMQ repeatable jobs or a scheduler (node-cron, or the
platform's scheduler).

**33. How do you scale an Express API?**
Run multiple processes (Node cluster, PM2, containers) behind a load balancer; keep the app
stateless (sessions/tokens in DB/Redis, shared rate-limit store); pool DB connections and add
PgBouncer; cache hot reads (Redis); move slow work to queues; add read replicas if
reads dominate.

**34. How would you document this API?**
Generate OpenAPI from the Zod schemas (`zod-openapi` / `@asteasolutions/zod-to-openapi`) and
serve it with Swagger UI or Scalar, so validation and documentation share one source of truth.

**35. When would you pick NestJS over plain Express?**
For large teams wanting Laravel-like structure out of the box: modules, built-in DI container,
decorators for routing/validation/guards, interceptors, testing utilities. Plain Express (as
here) is lighter and fully explicit, but the architecture discipline is on you.

---

## 27. Migration checklist

- [ ] Inventory the API contract: routes, methods, request fields, response envelope,
      status codes, validation messages, token format, file exports
- [ ] Choose the stack (framework, ORM, validation, logger, mail, test runner) and pin versions
- [ ] Set up TypeScript (ESM, strict), ESLint, Prettier, scripts
- [ ] Database: Docker Compose service + test database
- [ ] Port migrations to the ORM schema; add missing indexes/constraints; generate the initial migration
- [ ] Port factories and seeders (batched inserts, set-based totals)
- [ ] Validated config module; `.env.example`
- [ ] Infrastructure: Prisma singleton, logger, hasher, mailer strategy, HttpError + error handler, response helpers
- [ ] Middleware: authenticate (token scheme), authorize (roles), validate (schemas), rate limiting, CORS, helmet
- [ ] Modules: schema → service → controller → routes → resource, one feature at a time
- [ ] Transactions for multi-write operations; DB-enforced uniqueness
- [ ] Streaming exports
- [ ] Composition root + `createApp` + `server.ts` with graceful shutdown + `/up`
- [ ] Integration tests for every endpoint and role; unit tests for helpers
- [ ] Contract check: same requests against both backends, compare responses
- [ ] Point the frontends at the new API (`NUXT_PUBLIC_API_BASE`, `NEXT_PUBLIC_API_BASE`) and click through
- [ ] Production: `migrate deploy` in release, process manager/containers, shared stores, queues, monitoring
