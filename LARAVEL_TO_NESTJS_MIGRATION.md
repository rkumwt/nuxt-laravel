# Migrating a Laravel API to NestJS + PostgreSQL — A Practical Guide

This guide converts the **URL Shortener API** from **Laravel 12 + MySQL** in `backend/` to
**NestJS 12 + TypeORM 1 + PostgreSQL** in `backend-nestjs/`.

Like the Express port (`backend-express/`, see
[LARAVEL_TO_EXPRESS_MIGRATION.md](LARAVEL_TO_EXPRESS_MIGRATION.md)), it is a **drop-in
replacement**: same endpoints, request fields, response JSON, status codes and validation
messages, so the Nuxt and Next.js frontends work against it unchanged.

NestJS is the closest thing to Laravel in the Node world: an opinionated framework with a
**dependency-injection container, modules, guards, pipes, interceptors, exception filters,
a CLI and testing utilities**. Much of the migration is mapping one framework's building
block onto the other's.

| | Laravel app | NestJS app |
|---|---|---|
| Language / runtime | PHP 8.3 | TypeScript 6 on Node.js 20.19+ (ESM) |
| Framework | Laravel 12 | NestJS 12 (Express platform) |
| Database | MySQL | PostgreSQL 17 (Docker, port 5433) |
| ORM / migrations | Eloquent + migrations | TypeORM 1.x entities + generated migrations |
| Validation | FormRequest rules | DTO classes + class-validator + global `ValidationPipe` |
| Auth | Sanctum personal access tokens | Same scheme: `AccessTokenService` + global `AccessTokenGuard` |
| Authorization | `FormRequest::authorize()` | `@Roles()` decorator + `RolesGuard` |
| Response envelope | `ApiBaseController::success()` | `@PostAction()` decorator + `ResponseEnvelopeInterceptor` |
| Errors | Exception handler | Global `AllExceptionsFilter` |
| Config | `config/*.php` | `@nestjs/config` `registerAs()` namespaces + validation |
| Mail | Mailables + Blade | `MAILER` provider (strategy) + template functions |
| Export | maatwebsite/excel | `StreamableFile` + `csv-stringify` |
| Throttling | `throttle` middleware | `@nestjs/throttler` |
| Logging | Monolog | `nestjs-pino` |
| Health | `/up` | `@nestjs/terminus` with a DB ping |
| Tests | PHPUnit | Vitest: unit (`*.spec.ts`) + e2e (`test/*.e2e-spec.ts`) |
| Port | 8000 | 8002 |

---

## Table of Contents

1. [Why NestJS feels familiar to Laravel developers](#1-why-nestjs-feels-familiar)
2. [Concept map: Laravel → NestJS](#2-concept-map-laravel--nestjs)
3. [Package choices](#3-package-choices)
4. [Folder structure and file map](#4-folder-structure-and-file-map)
5. [The request lifecycle](#5-the-request-lifecycle)
6. [Design patterns used](#6-design-patterns-used)
7. [Step 1 — Scaffold with the Nest CLI (Nest 12 defaults)](#7-step-1--scaffold)
8. [Step 2 — PostgreSQL with Docker](#8-step-2--postgresql-with-docker)
9. [Step 3 — Configuration: `config/*.php` → `registerAs()`](#9-step-3--configuration)
10. [Step 4 — Modules: service providers → `@Module()`](#10-step-4--modules)
11. [Step 5 — Eloquent models → TypeORM entities](#11-step-5--eloquent-models--typeorm-entities)
12. [Step 6 — Migrations](#12-step-6--migrations)
13. [Step 7 — Repositories and transactions](#13-step-7--repositories-and-transactions)
14. [Step 8 — Seeders and factories](#14-step-8--seeders-and-factories)
15. [Step 9 — Routes → controllers with decorators](#15-step-9--routes--controllers)
16. [Step 10 — Sanctum → guards](#16-step-10--sanctum--guards)
17. [Step 11 — FormRequest → DTO + ValidationPipe](#17-step-11--formrequest--dto--validationpipe)
18. [Step 12 — Response envelope → interceptor](#18-step-12--response-envelope--interceptor)
19. [Step 13 — Exception handler → exception filter](#19-step-13--exception-handler--exception-filter)
20. [Step 14 — Services and API resources](#20-step-14--services-and-api-resources)
21. [Step 15 — Mail](#21-step-15--mail)
22. [Step 16 — Excel export → `StreamableFile`](#22-step-16--excel-export--streamablefile)
23. [Step 17 — Web routes, health check, bootstrap](#23-step-17--web-routes-health-check-bootstrap)
24. [Step 18 — Testing](#24-step-18--testing)
25. [NestJS vs Express port: what changed](#25-nestjs-vs-express-port)
26. [Bugs fixed and behaviour changes](#26-bugs-fixed-and-behaviour-changes)
27. [Pitfalls to watch for](#27-pitfalls-to-watch-for)
28. [Interview questions and answers](#28-interview-questions-and-answers)
29. [Migration checklist](#29-migration-checklist)

---

## 1. Why NestJS feels familiar

| Laravel idea | NestJS equivalent |
|---|---|
| Service container with auto-resolution by type-hint | IoC container that resolves constructor parameters by type (`emitDecoratorMetadata`) |
| Service providers group bindings | `@Module({ providers, controllers, imports, exports })` |
| Route attributes / route files | `@Controller('prefix')` + `@Get()` / `@Post()` method decorators |
| Middleware (`auth`, `throttle`) | Middleware, **guards** (allow/deny), **interceptors** (wrap the handler) |
| FormRequest (`authorize` + `rules`) | Guard (`canActivate`) + DTO class validated by a **pipe** |
| Exception handler | **Exception filters** |
| Eloquent models | TypeORM entities (data mapper) |
| `php artisan make:*` | `nest generate module|controller|service|guard|…` |
| Facades / helpers (`auth()`, `config()`) | Injected services (`@Inject(appConfig.KEY)`), param decorators (`@CurrentUser()`) |
| `Mail::fake()`, `$this->mock()` | `Test.createTestingModule().overrideProvider(X).useValue(fake)` |

The main differences:
- **Everything is explicit and typed.** Nothing is found by naming convention (no automatic
  controller or model discovery). Modules declare what they provide and import.
- **Decorators carry metadata.** Routes, roles, validation rules and "public" flags are
  decorators read at runtime through `Reflector`.
- **It's still Node.** One long-lived async process: state in module scope is shared across
  requests, the event loop must not be blocked, and graceful shutdown matters.

---

## 2. Concept map: Laravel → NestJS

| Laravel | NestJS (this project) | File(s) |
|---|---|---|
| `public/index.php` | `main.ts` (`NestFactory.create`, `listen`) | `src/main.ts` |
| `bootstrap/app.php` | `AppModule` + `configureApp()` | `src/app.module.ts`, `src/configure-app.ts` |
| Service providers | Modules | `src/modules/*/*.module.ts` |
| `config/*.php` + `.env` | `ConfigModule` + `registerAs()` namespaces + `validateEnv` | `src/config/*` |
| `routes/api.php` | Controllers + `app.setGlobalPrefix('api')` | `*.controller.ts` |
| `routes/web.php` | `RedirectController`, `HealthController` excluded from the prefix | `configure-app.ts` |
| `Route::prefix('superadmin')` | `@Controller('superadmin/clients')` | |
| `auth:sanctum` | Global `AccessTokenGuard` (`APP_GUARD`) + `@Public()` opt-out | `modules/auth/guards/access-token.guard.ts` |
| `FormRequest::authorize()` | `@Roles([...])` + global `RolesGuard` | `modules/auth/guards/roles.guard.ts` |
| `FormRequest::rules()` | DTO class + global `ValidationPipe` | `*/dto/*.ts`, `common/pipes/validation.pipe.ts` |
| `unique:users,email` | `@IsUnique(User, 'email')` async constraint with DI | `common/validation/is-unique.validator.ts` |
| `same:password` | `@SameAs('password')` custom decorator | `common/validation/same-as.validator.ts` |
| `$request->user()` | `@CurrentUser()` param decorator | `common/decorators/current-user.decorator.ts` |
| `ApiBaseController::success()` | `@PostAction(path, message)` + `ResponseEnvelopeInterceptor` | `common/decorators`, `common/interceptors` |
| Exception handler | `AllExceptionsFilter` (`APP_FILTER`) | `common/filters/all-exceptions.filter.ts` |
| Eloquent model | TypeORM `@Entity()` | `modules/*/entities/*.entity.ts` |
| Query logic in controllers | Repository classes | `database/repositories/*` |
| `DB::transaction()` | `UnitOfWork.run()` → `dataSource.transaction()` | `database/unit-of-work.ts` |
| Migrations | TypeORM migrations (generated from entities) | `database/migrations/*` |
| Seeders / factories | `database/seeds/seed.ts`, `factories.ts` | |
| API Resources | `to*Resource()` mapper functions | `modules/*/*.resource.ts` |
| Mailable + Blade | `MAILER` custom provider + template functions | `modules/mail/*` |
| Excel export | `StreamableFile` + streamed CSV | `common/utils/csv.ts` |
| `throttle` middleware | `ThrottlerModule` + `@UseGuards(ThrottlerGuard)` | `app.module.ts`, `auth.controller.ts` |
| `Hash` facade | `PasswordHasher` provider | `modules/auth/password-hasher.service.ts` |
| `/up` | `@nestjs/terminus` | `modules/health/*` |
| `php artisan serve` | `npm run start:dev` | |
| `php artisan test` | `npm test` + `npm run test:e2e` | |

---

## 3. Package choices

All are official `@nestjs/*` packages or the libraries the Nest documentation recommends.

| Package | Role | Laravel equivalent |
|---|---|---|
| `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express` | Framework (on Express) | `laravel/framework` |
| `@nestjs/config` | `.env`, typed config namespaces, validation | `config/*.php` |
| `@nestjs/typeorm` + `typeorm` + `pg` | ORM, migrations, Postgres driver | Eloquent + migrations |
| `class-validator` + `class-transformer` | DTO validation and transformation | FormRequest rules |
| `@nestjs/mapped-types` | `IntersectionType`, `PartialType`… for composing DTOs | — |
| `@nestjs/throttler` | Rate limiting | `throttle` |
| `@nestjs/terminus` | Health checks | `/up` |
| `nestjs-pino` + `pino-http` | Structured request logging | Monolog |
| `helmet` | Security headers | — |
| `bcryptjs` | Password hashing | `Hash` (bcrypt) |
| `nodemailer` | SMTP | Mail |
| `csv-stringify` | CSV streaming | maatwebsite/excel |
| `dotenv` | `.env` for the TypeORM CLI and seeder (outside Nest) | — |
| Dev: `@nestjs/cli`, `@nestjs/testing`, `vitest`, `supertest`, `oxlint`, `prettier`, `tsx`, `@faker-js/faker`, `pino-pretty` | Tooling | artisan, PHPUnit, Pint |

**Why TypeORM (and not Prisma, as in the Express port)?** `@nestjs/typeorm` is an official
integration and the most common choice in Nest codebases. Its decorator-based entities fit
Nest's style and feel close to Eloquent models. Prisma, Drizzle and MikroORM also work
with Nest, and the Express guide covers Prisma.

**Removed from the scaffold:** `@nestjs/mau` (Nest's cloud deploy CLI) pulled in vulnerable
transitive dev dependencies (`tmp`, `undici`) and isn't needed. After removing it, `npm audit`
reports **0 vulnerabilities**. `vite-tsconfig-paths` was also dropped because Vite now resolves
tsconfig paths natively.

---

## 4. Folder structure and file map

```
backend-nestjs/
├── docker-compose.yml               # Postgres 17 on :5433 (+ test DB via docker/postgres/init.sql)
├── nest-cli.json, tsconfig*.json, vitest.config*.ts, .oxlintrc.json, .prettierrc
├── src/
│   ├── main.ts                      # ← public/index.php
│   ├── configure-app.ts             # helmet, CORS, /api prefix, useContainer, shutdown hooks
│   ├── app.module.ts                # ← bootstrap/app.php + providers: global guards/pipe/interceptor/filter
│   ├── config/                      # ← config/*.php
│   │   ├── app.config.ts, auth.config.ts, database.config.ts, mail.config.ts
│   │   └── env.validation.ts
│   ├── common/
│   │   ├── decorators/              # @Public, @Roles, @ResponseMessage, @PostAction, @CurrentUser
│   │   ├── dto/pagination.dto.ts
│   │   ├── exceptions/              # ValidationException (422 + error bag)
│   │   ├── filters/                 # AllExceptionsFilter (← exception handler)
│   │   ├── interceptors/            # ResponseEnvelopeInterceptor (← ApiBaseController)
│   │   ├── pipes/validation.pipe.ts # (← FormRequest validation)
│   │   ├── validation/              # Laravel rule decorators, @IsUnique, @SameAs
│   │   └── utils/                   # pagination, csv, dates, random, html
│   ├── database/
│   │   ├── typeorm.options.ts       # shared by app + CLI
│   │   ├── data-source.ts           # TypeORM CLI / seeder entry
│   │   ├── entities.ts, timestamped.entity.ts
│   │   ├── repositories/            # one per aggregate + BaseRepository
│   │   ├── unit-of-work.ts          # transactions across repositories
│   │   ├── database.module.ts       # @Global persistence module
│   │   ├── migrations/              # ← database/migrations
│   │   └── seeds/                   # ← database/seeders + factories
│   └── modules/
│       ├── auth/                    # controller, service, access tokens, hasher, guards, dto, entity
│       ├── invitations/             # controller, service, dto, entity, resource
│       ├── clients/                 # superadmin
│       ├── team-members/            # admin
│       ├── short-urls/              # 3 controllers, service, dto, entity, resource
│       ├── mail/                    # MAILER provider, templates
│       ├── health/                  # /up
│       ├── users/, companies/       # entities + enums
└── test/                            # e2e specs + helpers + global setup
```

### Laravel → NestJS file map

| Laravel (`backend/`) | NestJS (`backend-nestjs/`) |
|---|---|
| `database/migrations/*.php` | `src/modules/*/entities/*.entity.ts` → `src/database/migrations/*-Init.ts` |
| `app/Models/*.php` | `src/modules/*/entities/*.entity.ts` + `src/database/repositories/*` |
| `app/Http/Controllers/ApiBaseController.php` | `ResponseEnvelopeInterceptor` + `AllExceptionsFilter` |
| `app/Http/Requests/ApiBaseRequest.php` | `createValidationPipe()` + `ValidationException` |
| `app/Http/Requests/Api/LoginRequest.php` | `src/modules/auth/dto/login.dto.ts` |
| `app/Http/Requests/Invitation/RegisterRequest.php` | `src/modules/invitations/dto/register.dto.ts` |
| `…/Superadmin/Clients/ClientsInviteRequest.php` | `InviteDto` + `@Roles([Superadmin])` |
| `…/Admin/TeamMembers/TeamMembersInviteRequest.php` | `TeamMemberInviteDto` + `@Roles([Admin])` |
| `…/ShortUrls/*Request.php` | `src/modules/short-urls/dto/short-url.dto.ts` + `@Roles` |
| `Api/AuthController.php` | `src/modules/auth/{auth.controller,auth.service,access-token.service}.ts` |
| `Api/InvitationController.php` | `src/modules/invitations/{invitations.controller,invitations.service}.ts` |
| `Api/Superadmin/ClientsController.php` | `src/modules/clients/*` |
| `Api/Admin/TeamMembersController.php` | `src/modules/team-members/*` |
| `Api/{Superadmin,Admin}/ShortUrlsController.php` | `src/modules/short-urls/controllers/{superadmin,company}-short-urls.controller.ts` + `short-urls.service.ts` |
| `ShortUrlRedirectController.php` | `src/modules/short-urls/controllers/redirect.controller.ts` |
| `app/Exports/*.php` | `short-url.resource.ts` rows + `common/utils/csv.ts` |
| `app/Mail/*.php` + `resources/views/emails/*` | `src/modules/mail/{mailer,mail.module}.ts`, `templates/invitations.ts` |
| `routes/api.php`, `routes/web.php` | controller decorators + `setGlobalPrefix('api', { exclude })` |
| `config/*.php` | `src/config/*` |
| `database/seeders/*`, `database/factories/*` | `src/database/seeds/{seed,factories}.ts` |

---

## 5. The request lifecycle

```
Incoming request
  → Express middleware          helmet, CORS, body parser, pino-http        (configureApp, LoggerModule)
  → Guards                      AccessTokenGuard → RolesGuard → ThrottlerGuard (route-level)
  → Interceptors (before)       ResponseEnvelopeInterceptor
  → Pipes                       ValidationPipe → DTO instance (or 422)
  → Controller method           thin: calls a service
  → Service                     business rules, UnitOfWork transactions, repositories
  → Interceptors (after)        wraps return value in { status, message, data }
  → Exception filter            any thrown error → { status: false, message, errors }
```

| Laravel step | Nest step | Status on failure |
|---|---|---|
| `auth:sanctum` middleware | `AccessTokenGuard` | 401 `Unauthenticated` |
| `FormRequest::authorize()` | `RolesGuard` | 403 `This action is unauthorized.` |
| `FormRequest::rules()` | `ValidationPipe` | 422 `Validation error` + `errors` |
| Controller | Controller → service | — |
| `ApiBaseController::success()` | Interceptor | — |
| Exception handler | Exception filter | — |

The order is the same in both frameworks: **401 → 403 → 422**. An e2e test checks that a
member posting an empty body to an admin-only endpoint gets **403**, not 422.

---

## 6. Design patterns used

| Pattern | Where | Notes |
|---|---|---|
| **Dependency Injection / IoC container** | everywhere (constructor injection) | Nest resolves providers by class token or custom tokens (`MAILER`, `appConfig.KEY`) |
| **Module pattern** | `*.module.ts` | Encapsulation: modules export only what others may use |
| **Layered architecture** | Controller → Service → Repository → TypeORM | Controllers know HTTP, services know business rules, repositories know SQL |
| **Repository** | `database/repositories/*` | Intention-revealing data access; hides TypeORM |
| **Unit of Work** | `UnitOfWork.run()` | Transaction-bound repository copies via `withManager(manager)` |
| **Strategy** | `Mailer` → `SmtpMailer` / `LogMailer` / `FakeMailer` | Selected by a **factory provider** |
| **Factory provider** | `MailModule`, `APP_FILTER`, `TypeOrmModule.forRootAsync` | Build instances from configuration |
| **Decorator (metadata)** | `@Public`, `@Roles`, `@PostAction`, DTO rules | Declarative cross-cutting concerns |
| **Chain of Responsibility** | guards → interceptors → pipes → handler → filters | Nest's request pipeline |
| **Interceptor / AOP** | `ResponseEnvelopeInterceptor` | Wraps every handler's result without touching it |
| **DTO** | `*.dto.ts` (input), `*.resource.ts` (output) | Explicit contracts both ways |
| **Template Method** | `BaseRepository` (shared `repo`, `withManager`) | Subclasses add queries |
| **Iterator / Generator** | `ShortUrlsRepository.iterate()`, `exportAll()` | Constant-memory exports |
| **Singleton scope** | Nest providers (default scope) | One instance per app, like Laravel `singleton()` |

---

## 7. Step 1 — Scaffold

```bash
npx @nestjs/cli@12 new backend-nestjs --package-manager npm --skip-git --strict
```

**Nest 12 changed the defaults** (it's newer than most tutorials):

| | Nest ≤ 11 scaffold | Nest 12 scaffold |
|---|---|---|
| Modules | CommonJS | **ESM** (`"type": "module"`, imports end in `.js`) |
| Tests | Jest | **Vitest** |
| Linter | ESLint | **oxlint** (type-aware) |
| TypeScript | 5.x | **6.x** |
| Validation | class-validator | class-validator **or Standard Schema** (Zod/Valibot/ArkType) in `@Body({ schema })` |
| Decorators | `SetMetadata` | `Reflector.createDecorator()` recommended |

This project follows the new defaults. ESM means relative imports carry the `.js` extension:

```ts
import { AuthService } from './auth.service.js';
```

Then:

```bash
npm i @nestjs/typeorm typeorm pg @nestjs/config @nestjs/throttler @nestjs/terminus \
      @nestjs/mapped-types nestjs-pino pino-http pino class-validator class-transformer \
      helmet bcryptjs nodemailer csv-stringify dotenv
npm i -D @types/nodemailer @types/pg @faker-js/faker pino-pretty tsx
npm uninstall @nestjs/mau vite-tsconfig-paths
```

Generators, the equivalent of `php artisan make:*`:

```bash
nest g module modules/clients
nest g controller modules/clients --flat
nest g service modules/clients --flat
nest g guard modules/auth/guards/roles
nest g interceptor common/interceptors/response-envelope
```

### Scripts

| Script | Command | Laravel |
|---|---|---|
| `start:dev` | `nest start --watch` | `php artisan serve` |
| `build` / `start:prod` | `nest build` / `node dist/main` | — |
| `migration:generate` | `tsx ./node_modules/typeorm/cli.js -d src/database/data-source.ts migration:generate <path>` | `make:migration` (but diffed automatically) |
| `migration:run` / `migration:revert` | TypeORM CLI | `migrate` / `migrate:rollback` |
| `migration:run:prod` | `typeorm migration:run -d dist/database/data-source.js` | `migrate --force` |
| `db:seed` | `tsx src/database/seeds/seed.ts` | `db:seed` |
| `db:fresh` | `schema:drop` + `migration:run` + `db:seed` | `migrate:fresh --seed` |
| `test` / `test:e2e` | `vitest run` (unit / e2e config) | `php artisan test` |
| `lint` / `typecheck` / `format` | oxlint / `tsc --noEmit` / prettier | Pint / PHPStan |

---

## 8. Step 2 — PostgreSQL with Docker

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:17-alpine
    container_name: url-shortener-nest-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: url_shortener
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: url_shortener
    ports:
      # 5433 so it can run next to backend-express's database on 5432
      - "5433:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U url_shortener -d url_shortener"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  postgres-data:
```

Each backend owns its database, so the Express and Nest ports never share data and can be
reset independently.

---

## 9. Step 3 — Configuration

### Laravel

```php
// config/app.php
'frontend_url' => env('FRONTEND_URL', 'http://localhost:3000'),
// usage anywhere
config('app.frontend_url');
```

### NestJS: namespaced, typed, injected

```ts
// src/config/app.config.ts
export const appConfig = registerAs('app', () => {
  const env = process.env.NODE_ENV ?? 'development';
  const frontendUrl = trimSlash(process.env.FRONTEND_URL ?? 'http://localhost:3000');

  return {
    env,
    isProduction: env === 'production',
    isTest: env === 'test',
    port: Number(process.env.PORT ?? 8002),
    url: trimSlash(process.env.APP_URL ?? 'http://localhost:8002'),
    frontendUrl,
    corsOrigins: (process.env.CORS_ALLOWED_ORIGINS || frontendUrl).split(',').map((o) => o.trim()),
    trustProxy: Number(process.env.TRUST_PROXY ?? 0),
    logLevel: process.env.LOG_LEVEL ?? 'info',
  };
});
```

```ts
// usage: inject the namespace, fully typed
constructor(@Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>) {}
// this.app.frontendUrl
```

```ts
// src/app.module.ts
ConfigModule.forRoot({
  isGlobal: true,
  cache: true,
  envFilePath: process.env.NODE_ENV === 'test' ? '.env.test' : '.env',
  load: [appConfig, authConfig, databaseConfig, mailConfig],
  validate: validateEnv,
}),
```

### Fail-fast validation

```ts
// src/config/env.validation.ts (excerpt)
export class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV = 'development';

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  PORT = 8002;

  @IsString()
  DATABASE_URL!: string;

  @Transform(({ value }) => Number(value))
  @IsInt() @Min(4) @Max(15)
  BCRYPT_ROUNDS = 12;
  // …
}

export function validateEnv(config: Record<string, unknown>) {
  const env = plainToInstance(EnvironmentVariables, config, { exposeDefaultValues: true });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Invalid environment variables:\n  ${/* field: messages */ ''}`);
  }
  return env;
}
```

A bad `.env` stops the app at boot with every problem listed. Laravel would return `null`
from `env()` and fail later. (Nest 12 also accepts any Standard Schema, such as Zod, as
`validationSchema`.)

| Laravel `.env` | NestJS `.env` |
|---|---|
| `APP_ENV=local` | `NODE_ENV=development` |
| `APP_URL` | `APP_URL=http://localhost:8002` (short links) |
| `DB_*` | `DATABASE_URL=postgresql://url_shortener:secret@localhost:5433/url_shortener` |
| `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, `BCRYPT_ROUNDS`, `MAIL_*` | same |
| `config/sanctum.php` `expiration` | `TOKEN_EXPIRATION_MINUTES` |
| — | `LOGIN_RATE_LIMIT` (per IP per minute), `DB_LOGGING`, `LOG_LEVEL`, `TRUST_PROXY` |

---

## 10. Step 4 — Modules

A Laravel **service provider** registers bindings; a Nest **module** declares:
- `providers`: classes the container can create (services, repositories, guards…)
- `controllers`: route handlers
- `imports`: other modules whose exports it needs
- `exports`: providers other modules may inject

```ts
// src/modules/invitations/invitations.module.ts
@Module({
  imports: [AuthModule],                 // needs PasswordHasher (exported by AuthModule)
  controllers: [InvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],         // used by ClientsModule and TeamMembersModule
})
export class InvitationsModule {}
```

Module graph:

```
AppModule
├── ConfigModule (global)   LoggerModule   ThrottlerModule
├── DatabaseModule (global): TypeORM, repositories, UnitOfWork, IsUniqueConstraint
├── MailModule (global): MAILER
├── AuthModule ── exports AccessTokenService, PasswordHasher
├── InvitationsModule ── imports AuthModule, exports InvitationsService
├── ClientsModule ── imports InvitationsModule
├── TeamMembersModule ── imports InvitationsModule
├── ShortUrlsModule
└── HealthModule ── imports TerminusModule
```

**Why a global `DatabaseModule` holds every repository.** The `UnitOfWork` needs all
repositories to build transaction-bound copies. If each feature module owned its repository,
`UnitOfWork` would have to import every feature module, and those modules import
`UnitOfWork`: a circular dependency. A shared persistence module is the standard fix. Entities
still live in their feature folders.

**Global request pipeline** is registered as providers, so it's DI-aware and applies in tests
automatically:

```ts
// src/app.module.ts
providers: [
  // auth:sanctum (401) → authorize() (403) → rules() (422) → controller
  { provide: APP_GUARD, useClass: AccessTokenGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
  { provide: APP_PIPE, useFactory: createValidationPipe },
  { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
  {
    provide: APP_FILTER,
    inject: [HttpAdapterHost, appConfig.KEY],
    useFactory: (adapterHost: HttpAdapterHost, app: ConfigType<typeof appConfig>) =>
      new AllExceptionsFilter(adapterHost, !app.isProduction),
  },
],
```

> `app.useGlobalGuards()` in `main.ts` also works, but those instances live outside the
> container: they can't inject services, and Nest's testing module doesn't apply them.
> `APP_*` providers avoid both problems.

---

## 11. Step 5 — Eloquent models → TypeORM entities

### Laravel

```php
// database/migrations/…_create_short_urls_table.php
Schema::create('short_urls', function (Blueprint $table) {
    $table->id();
    $table->foreignId('company_id')->constrained()->cascadeOnDelete();
    $table->string('url');
    $table->string('short_url_code');
    $table->integer('hits')->default(0);
    $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
    $table->timestamps();
});

// app/Models/ShortUrl.php
class ShortUrl extends Model {
    protected $appends = ['short_url'];
    protected $fillable = ['company_id', 'url', 'short_url_code', 'hits', 'created_by'];
}
```

### NestJS / TypeORM

```ts
// src/database/timestamped.entity.ts — $table->timestamps()
export abstract class TimestampedEntity {
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', precision: 3 })
  updatedAt: Date;
}
```

```ts
// src/modules/short-urls/entities/short-url.entity.ts
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
```

```ts
// src/modules/users/entities/user.entity.ts (excerpt)
// Like Laravel's $hidden: never loaded unless explicitly selected
@Column({ type: 'varchar', length: 255, nullable: true, select: false })
password: string | null;

@Column({ type: 'enum', enum: UserType, enumName: 'user_type', default: UserType.Admin })
type: UserType;
```

| Laravel | TypeORM |
|---|---|
| `$table->id()` | `@PrimaryGeneratedColumn({ type: 'int' })` |
| `foreignId()->constrained()->cascadeOnDelete()` | scalar `@Column({ name: 'company_id' })` + `@ManyToOne(..., { onDelete: 'CASCADE' })` + `@JoinColumn` |
| `belongsTo` / `hasMany` | `@ManyToOne` / `@OneToMany` |
| `string()` / `text()` | `@Column({ type: 'varchar', length: 255 })` / `'text'` |
| `nullable()` | `nullable: true` + `T \| null` type |
| `unique()` / index | `@Index({ unique: true })` / `@Index()` / class-level `@Index([...])` |
| `enum()` | `type: 'enum', enum: UserType, enumName: 'user_type'` (named Postgres type, shared by `users.type` and `invitations.role`) |
| `boolean()` | `type: 'boolean'` |
| `timestamps()` | `@CreateDateColumn` + `@UpdateDateColumn` (base class) |
| `$hidden = ['password']` | `select: false` |
| `$casts` | column types + TS types (`isGlobal: boolean`) |
| `$fillable` | not needed: DTOs whitelist input before it reaches entities |
| `$appends` (`short_url`) | computed in the resource mapper |

Decisions:
- **`Relation<T>` wrapper on relation properties.** With ESM + `emitDecoratorMetadata`,
  `company: Company` emits a reference to `Company` at class-definition time. `User` ↔
  `Company` import each other, so that becomes "Cannot access 'Company' before initialization".
  TypeORM's `Relation<T>` type avoids the runtime reference.
- **Explicit column `type` everywhere.** Without it TypeORM infers types from
  `design:type` decorator metadata. The TypeORM CLI and seeder run through `tsx` (esbuild),
  which does **not** emit decorator metadata, so explicit types keep entities working in every
  runtime, and they document the schema.
- **`timestamptz` with millisecond precision.** Stores absolute instants (no server-timezone
  ambiguity) and matches JS `Date` precision, which the keyset pagination in exports compares
  against (§22).
- **`nullable: false` on required relations.** TypeORM 1.0 uses INNER JOIN for them, which
  is correct here.

---

## 12. Step 6 — Migrations

TypeORM can **generate** migrations by diffing entities against the database, much like
Prisma, and unlike Laravel where you write them by hand.

```ts
// src/database/typeorm.options.ts — shared by the app and the CLI
const extension = import.meta.url.endsWith('.ts') ? 'ts' : 'js';
const migrations = fileURLToPath(new URL(`./migrations/*.${extension}`, import.meta.url));

export const typeOrmOptions = (url: string, logging = false): DataSourceOptions => ({
  type: 'postgres',
  url,
  entities,
  migrations: [migrations],
  // Schema changes only ever happen through migrations
  synchronize: false,
  logging,
});
```

```ts
// src/database/data-source.ts — entry for the TypeORM CLI and the seeder
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { typeOrmOptions } from './typeorm.options.js';

export default new DataSource(typeOrmOptions(process.env.DATABASE_URL ?? ''));
```

```bash
npm run migration:generate -- src/database/migrations/Init   # diff entities → SQL
npm run migration:run                                        # apply
npm run migration:revert                                     # roll back the last one
```

<!-- MIGRATION_EXCERPT -->

Rules:
- **`synchronize: false` always.** `synchronize: true` auto-alters tables on startup and can
  drop data. Use migrations only, as with Laravel.
- Migrations are committed TypeScript classes with `up`/`down` (same idea as Laravel).
- The CLI runs through **`tsx`** because the project is ESM TypeScript. Production runs the
  compiled `dist/database/data-source.js`; the migrations glob picks `.ts` or `.js` from
  whichever file loaded it.

---

## 13. Step 7 — Repositories and transactions

TypeORM already offers `Repository<Entity>` (`@InjectRepository(User)`), and many Nest apps
use it directly in services. This project wraps it in **custom repository classes** for three
reasons:

1. Queries get **intention-revealing names** (`paginateClients`, `incrementUrlHits`) and live in
   one place.
2. Services can be unit-tested with plain object mocks.
3. The same class must work **inside a transaction**.

```ts
// src/database/repositories/base.repository.ts
// Repositories wrap an EntityManager so the same class works inside a
// transaction: withManager(tx) returns a copy bound to the transaction.
export abstract class BaseRepository<T extends ObjectLiteral> {
  protected constructor(
    protected readonly manager: EntityManager,
    private readonly entity: EntityTarget<T>,
  ) {}

  protected get repo(): Repository<T> {
    return this.manager.getRepository(this.entity);
  }

  withManager(manager: EntityManager): this {
    const Ctor = this.constructor as new (manager: EntityManager) => this;
    return new Ctor(manager);
  }
}
```

```ts
// src/database/repositories/users.repository.ts (excerpt)
@Injectable()
export class UsersRepository extends BaseRepository<User> {
  constructor(@InjectEntityManager() manager: EntityManager) {
    super(manager, User);
  }

  // The password column is select: false, so login asks for it explicitly
  findByEmailWithPassword(email: string) {
    return this.repo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  findWithCompany(id: number) {
    return this.repo.findOne({ where: { id }, relations: { company: true } });
  }

  async incrementUrlHits(id: number) {
    await this.repo.increment({ id }, 'totalUrlHits', 1);
  }
}
```

> **Why not `class X extends Repository<User>`?** That was the TypeORM 0.3 custom-repository
> recipe, but `EntityManager.withRepository()` re-instantiates the class with
> `(target, manager)`. That breaks a Nest constructor that expects injected dependencies.
> Composition plus `withManager()` is simpler and explicit.

### Unit of Work

```ts
// src/database/unit-of-work.ts
// DB::transaction() — runs work against repositories bound to one transaction
@Injectable()
export class UnitOfWork {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly accessTokens: AccessTokensRepository,
    private readonly companies: CompaniesRepository,
    private readonly invitations: InvitationsRepository,
    private readonly shortUrls: ShortUrlsRepository,
    private readonly users: UsersRepository,
  ) {}

  run<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    return this.dataSource.transaction((manager) =>
      work({
        accessTokens: this.accessTokens.withManager(manager),
        companies: this.companies.withManager(manager),
        invitations: this.invitations.withManager(manager),
        shortUrls: this.shortUrls.withManager(manager),
        users: this.users.withManager(manager),
      }),
    );
  }
}
```

### Eloquent → TypeORM cheat sheet

| Eloquent | TypeORM 1.x |
|---|---|
| `User::where('email', $e)->first()` | `repo.findOneBy({ email })` |
| `->firstOrFail()` | `findOneByOrFail(...)` |
| `->with('company')` | `findOne({ where, relations: { company: true } })` |
| `->select([...])` | `select: { id: true, name: true }` (object syntax; string arrays removed in 1.0) |
| `->exists()` | `existsBy({ ... })` (`exist()` removed in 1.0) |
| `->paginate($n)` | `findAndCount({ where, skip, take })` |
| `->orderBy('created_at', 'desc')` | `order: { createdAt: 'DESC' }` / `qb.orderBy('url.createdAt', 'DESC')` |
| `->whereBetween(...)` | `Between(a, b)` / `qb.andWhere('… BETWEEN :from AND :to')` |
| `->increment('hits')` | `repo.increment({ id }, 'hits', 1)` (atomic) |
| `updateOrCreate` | `repo.upsert(data, { conflictPaths: ['email'] })` (`INSERT … ON CONFLICT`) |
| joins | `createQueryBuilder().innerJoinAndSelect('url.creator', 'creator')` |
| `->whereNull('x')` | `where: { x: IsNull() }`. **Passing `null`/`undefined` now throws** (TypeORM 1.0) |
| `DB::transaction(fn)` | `dataSource.transaction(async (manager) => …)` |
| `DB::statement()` | `dataSource.query(sql, params)` |

> **TypeORM 1.0 gotcha:** `find({ where: { companyId: undefined } })` used to silently drop
> the condition (in 0.3, that could return **all rows**). In 1.0 it **throws** by default. The
> short-URL query builder only adds conditions that are defined.

---

## 14. Step 8 — Seeders and factories

```ts
// src/database/seeds/factories.ts (excerpt) — database/factories/*.php
export const shortUrlFactory = (overrides: Pick<ShortUrl, 'companyId' | 'createdBy'>): Partial<ShortUrl> => ({
  url: `${faker.internet.url({ appendSlash: false })}/${faker.lorem.slug()}.html`,
  shortUrlCode: unique(usedCodes, () => randomString(6)),
  hits: faker.number.int({ min: 0, max: 1000 }),
  createdAt: faker.date.recent({ days: 30 }),
  updatedAt: faker.date.recent({ days: 30 }),
  ...overrides,
});
```

`src/database/seeds/seed.ts` ports `CompanySeeder`, `ClientSeeder` and `ShortUrlsSeeder`
against the TypeORM `DataSource` (no Nest container needed):

| Laravel | NestJS port |
|---|---|
| `Schema::disableForeignKeyConstraints(); truncate()` | `TRUNCATE … RESTART IDENTITY CASCADE` |
| `Model::factory()->count(n)->create()` (row by row) | `repository.insert(rows)` in chunks of 1,000 (Postgres bind-parameter limit) |
| Per-row counter updates in a loop | Two set-based `UPDATE … FROM (SELECT … GROUP BY …)` |
| `env('APP_ENV') === 'local'` | `process.env.NODE_ENV !== 'production'` |

---

## 15. Step 9 — Routes → controllers

### Laravel

```php
Route::prefix('superadmin')->middleware('auth:sanctum')->group(function () {
    Route::post('/clients/invite', [ClientsController::class, 'invite']);
    Route::post('/clients', [ClientsController::class, 'index']);
});
```

### NestJS

```ts
// src/modules/clients/clients.controller.ts
@Roles([UserType.Superadmin])
@Controller('superadmin/clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @PostAction('invite', 'Invitation send successfully')
  async invite(@Body() dto: InviteDto) {
    await this.clients.invite(dto);
  }

  @PostAction('', 'Clients fetched successfully')
  index(@Body() dto: PaginationDto) {
    return this.clients.list(toPageRequest(dto));
  }
}
```

`@PostAction` is a **composed decorator**:

```ts
// src/common/decorators/post-action.decorator.ts
// Every Laravel endpoint is a POST answering 200 with a message
// (Nest defaults POST to 201)
export const PostAction = (path: string, message: string) =>
  applyDecorators(Post(path), HttpCode(HttpStatus.OK), ResponseMessage(message));
```

| Laravel | NestJS |
|---|---|
| `Route::post('/x', [C::class, 'm'])` | `@Post('x')` on method `m` of `@Controller()` class `C` |
| `{code}` | `:code` + `@Param('code') code: string` |
| `$request->input()` | `@Body() dto: SomeDto` (validated + typed) |
| `$request->query()` | `@Query()` |
| `$request->user()` | `@CurrentUser() user: User` |
| prefix groups | `@Controller('superadmin/clients')` + global prefix `api` |
| `->middleware('auth:sanctum')` | global guard; public routes use `@Public()` |
| returns 200 for POST | Nest returns **201** for POST unless `@HttpCode(200)` |
| `response()->json(...)` | return a value (serialized + intercepted) |
| `redirect($url)` | `@Redirect()` + return `{ url, statusCode }` |
| `Excel::download()` | return `new StreamableFile(stream)` |

> Laravel matched `/invitation/{code}/register` before `/invitation/{code}` because of
> registration order. Nest also matches in declaration order within a controller, so the
> `:code/register` handler is declared first.

---

## 16. Step 10 — Sanctum → guards

Tokens use Sanctum's exact format and storage (`"<id>|<40 random chars>"`, SHA-256 hash in
`personal_access_tokens`), so behaviour is identical:

```ts
// src/modules/auth/access-token.service.ts (excerpt)
async issue(userId: number, name = 'api-token') {
  const plain = randomString(40);
  const minutes = this.config.tokenExpirationMinutes;
  const expiresAt = minutes ? new Date(Date.now() + minutes * 60_000) : null;

  const record = await this.tokens.create({ userId, name, token: sha256(plain), expiresAt });
  return `${record.id}|${plain}`;
}

async verify(bearer: string) {
  // split "<id>|<plain>", load by id (or by hash), constant-time compare,
  // check expiry, update last_used_at
}
```

### `auth:sanctum` → global guard with opt-out

```ts
// src/modules/auth/guards/access-token.guard.ts
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokens: AccessTokenService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const [scheme, bearer] = (request.headers.authorization ?? '').split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !bearer) {
      throw new UnauthorizedException('Unauthenticated');
    }

    const auth = await this.accessTokens.verify(bearer);
    if (!auth) throw new UnauthorizedException('Unauthenticated');

    request.auth = auth;
    return true;
  }
}
```

**Secure by default:** Laravel adds `auth:sanctum` to protected routes (forgetting it makes
a route public). Here every route requires a token **unless** it's marked `@Public()`
(login, invitations, redirect, health), so forgetting a decorator fails closed.

### `FormRequest::authorize()` → `@Roles` + `RolesGuard`

```ts
// src/common/decorators/roles.decorator.ts
export const Roles = Reflector.createDecorator<UserType[]>();

// src/modules/auth/guards/roles.guard.ts
canActivate(context: ExecutionContext) {
  const roles = this.reflector.getAllAndOverride(Roles, [context.getHandler(), context.getClass()]);
  if (!roles?.length) return true;

  const user = context.switchToHttp().getRequest<Request>().auth?.user;
  if (!user || !roles.includes(user.type)) {
    throw new ForbiddenException('This action is unauthorized.');
  }
  return true;
}
```

`Reflector.createDecorator()` (recommended in Nest 12) creates a **typed** metadata key:
`getAllAndOverride(Roles, …)` returns `UserType[] | undefined` with no string keys or casts.
`getAllAndOverride` lets a method-level `@Roles` override the class-level one.

### `@CurrentUser()`

```ts
// $request->user()
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => auth(ctx).user);
```

### Throttling the login

```ts
// app.module.ts
ThrottlerModule.forRootAsync({
  inject: [authConfig.KEY, appConfig.KEY],
  useFactory: (auth, app) => ({
    throttlers: [{ ttl: 60_000, limit: auth.loginRateLimit }],
    skipIf: () => app.isTest,
  }),
}),

// auth.controller.ts
@Public()
@UseGuards(ThrottlerGuard)
@PostAction('login', 'Login successful')
login(@Body() dto: LoginDto) { … }
```

The limiter counts **all** login requests per IP (default `LOGIN_RATE_LIMIT=10` per minute),
which is Throttler's standard behaviour. The Express port only counted failed attempts. The
Laravel app had no throttling at all. Use a Redis storage (`@nest-lab/throttler-storage-redis`)
when running several instances.

---

## 17. Step 11 — FormRequest → DTO + ValidationPipe

### The global pipe

```ts
// src/common/pipes/validation.pipe.ts
const collect = (errors: ValidationError[], prefix = '', bag: ValidationErrors = {}) => {
  for (const error of errors) {
    const key = prefix + error.property;
    if (error.constraints) bag[key] = Object.values(error.constraints);
    if (error.children?.length) collect(error.children, `${key}.`, bag);
  }
  return bag;
};

// FormRequest equivalent: validates and transforms request DTOs, strips
// undeclared fields (like $request->validated()) and reports Laravel's shape
export const createValidationPipe = () =>
  new ValidationPipe({
    transform: true,
    whitelist: true,
    stopAtFirstError: true,
    exceptionFactory: (errors) => new ValidationException(collect(errors)),
  });
```

| Option | Why |
|---|---|
| `transform: true` | `@Body() dto: LoginDto` is a real `LoginDto` instance with `@Transform`s applied |
| `whitelist: true` | Undeclared fields are stripped, like `$request->validated()`. Prevents mass-assignment (`is_admin: true`) |
| `stopAtFirstError: true` | One message per field, in decorator order, as Laravel's frontends expect (`errors.email[0]`) |
| `exceptionFactory` | Laravel's `{ field: [messages] }` bag inside a 422 |

### Laravel-compatible rule decorators

```ts
// src/common/validation/rules.ts (excerpt)
export const label = (field: string) => field.replace(/_/g, ' ');

// Laravel's TrimStrings + ConvertEmptyStringsToNull middleware
export const TrimToUndefined = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value ?? undefined;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  });

/** required|string */
export const Required = (field: string) =>
  applyDecorators(
    TrimToUndefined(),
    IsDefined({ message: `The ${label(field)} field is required.` }),
    IsString({ message: `The ${label(field)} field must be a string.` }),
  );

/** required|email */
export const RequiredEmail = (field: string) =>
  applyDecorators(
    Required(field),
    IsEmail({}, { message: `The ${label(field)} field must be a valid email address.` }),
  );

/** required|min:n */
export const RequiredMin = (field: string, min: number) =>
  applyDecorators(
    Required(field),
    MinLength(min, { message: `The ${label(field)} field must be at least ${min} characters.` }),
  );
```

### FormRequests → DTO classes

```php
// LoginRequest
'email' => 'required|email',
'password' => 'required|string'
```

```ts
// src/modules/auth/dto/login.dto.ts
export class LoginDto {
  @RequiredEmail('email')
  email: string;

  @Required('password')
  password: string;
}
```

```php
// ClientsInviteRequest / TeamMembersInviteRequest
'name'  => 'required',
'email' => 'required|email|unique:users,email',
'role'  => 'required|in:admin,member'
```

```ts
// src/modules/invitations/dto/invite.dto.ts
export class InviteDto {
  @Required('name')
  name: string;

  @IsUnique(User, 'email')
  @RequiredEmail('email')
  email: string;
}

export class TeamMemberInviteDto extends InviteDto {
  @RequiredIn('role', [UserType.Admin, UserType.Member])
  role: UserType.Admin | UserType.Member;
}
```

```ts
// src/modules/invitations/dto/register.dto.ts
export class RegisterDto {
  @Required('name') name: string;
  @RequiredEmail('email') email: string;
  @OptionalString('company_name') company_name?: string;
  @RequiredMin('password', 8) password: string;

  @SameAs('password')
  @Required('password_confirmation')
  password_confirmation: string;
}
```

### `unique:users,email` → async constraint with dependency injection

```ts
// src/common/validation/is-unique.validator.ts
@ValidatorConstraint({ name: 'isUnique', async: true })
@Injectable()
export class IsUniqueConstraint implements ValidatorConstraintInterface {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async validate(value: unknown, args: ValidationArguments) {
    if (typeof value !== 'string') return true;
    const [entity, column] = args.constraints as [EntityTarget<ObjectLiteral>, string];
    return !(await this.dataSource.getRepository(entity).existsBy({ [column]: value }));
  }
}
```

For class-validator to build the constraint through Nest's container (so the `DataSource`
gets injected), `configureApp` calls:

```ts
useContainer(app.select(AppModule), { fallbackOnErrors: true });
```

Because the unique check runs **inside validation**, all errors come back together, exactly
like Laravel:

```json
{ "status": false, "message": "Validation error",
  "errors": { "name": ["The name field is required."], "email": ["The email has already been taken."] } }
```

(The Express port did the unique check in the service, so it could only report it after
schema validation passed.)

### Decorator order matters

TypeScript applies property decorators **bottom-up**. class-validator registers them in that
order, and `stopAtFirstError` reports the first failure. So rules that should be checked
**later** go **above**:

```ts
@IsUnique(User, 'email')   // checked last
@RequiredEmail('email')    // checked first: required → string → email
email: string;
```

A unit test (`validation.pipe.spec.ts`) checks the exact messages and their order.

### Rules that need context stay in services

`company_name` is required **only** if the invitation came from the global company, which
needs the invitation from the database, so `InvitationsService.register()` throws
`ValidationException.withMessage('company_name', 'The company name field is required.')`.

### Pagination DTO: lenient like Laravel's paginator

```ts
export class PaginationDto {
  @Transform(({ value }) => toInt(value, 1))
  @IsInt()
  page: number = 1;

  @Transform(({ value }) => toInt(value, 10, MAX_PER_PAGE))
  @IsInt()
  per_page: number = 10;
}

// combined with filters
export class AllUrlsListDto extends IntersectionType(AllUrlsFilterDto, PaginationDto) {}
```

Invalid `page`/`per_page` fall back to defaults instead of failing (Laravel behaviour);
`per_page` is capped at 100. The `@IsInt()` is required: with `whitelist: true`, a property
with **no** validation decorator is stripped.

---

## 18. Step 12 — Response envelope → interceptor

Laravel controllers called `$this->success('Login successful', $data)`. Nest handlers just
**return data**, and an interceptor wraps it:

```ts
// src/common/interceptors/response-envelope.interceptor.ts
// ApiBaseController::success(): wraps handlers marked with @ResponseMessage /
// @PostAction in { status: true, message, data }. Others (CSV downloads,
// redirects, health) pass through untouched.
@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const message = this.reflector.get(ResponseMessage, context.getHandler());
    if (message === undefined) return next.handle();

    return next.handle().pipe(map((data: unknown) => ({ status: true, message, data: data ?? [] })));
  }
}
```

```ts
@PostAction('user', 'User Fetched successfully')
async user(@CurrentUser() user: User) {
  return { user: await this.auth.profile(user.id) };
}
// → { "status": true, "message": "User Fetched successfully", "data": { "user": {...} } }
```

Handlers stay focused on their result and the envelope is applied in one place. Interceptors
receive an RxJS `Observable`, so they can also time, cache or transform responses.

---

## 19. Step 13 — Exception handler → exception filter

```ts
// src/common/filters/all-exceptions.filter.ts (abridged)
// Laravel's exception handler: every error becomes { status: false, message, errors }
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly adapterHost: HttpAdapterHost, private readonly exposeErrors: boolean) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const { status, message, errors } = this.describe(exception);
    this.adapterHost.httpAdapter.reply(host.switchToHttp().getResponse(), { status: false, message, errors }, status);
  }

  private describe(exception: unknown) {
    if (exception instanceof ValidationException)  → 422, 'Validation error', exception.errors
    if (exception instanceof ThrottlerException)   → 429, 'Too Many Attempts.'
    if (exception instanceof HttpException)        → its status + message
        router 404 "Cannot POST /api/x"            → 'Not Found'
        body-parser JSON error                     → 'Malformed JSON in request body.'
    otherwise                                      → log stack, 500 'Server Error' (message in dev)
  }
}
```

Throwing works anywhere (guards, pipes, services), as Laravel's `abort()` does:

| Laravel | NestJS |
|---|---|
| `abort(404, 'Short URL not found')` | `throw new NotFoundException('Short URL not found')` |
| `$this->error('Invalid credentials', 403)` | `throw new ForbiddenException('Invalid credentials')` |
| `AuthenticationException` → 401 JSON | `throw new UnauthorizedException('Unauthenticated')` |
| `ValidationException::withMessages([...])` | `ValidationException.withMessage(field, message)` |
| `$this->error('Invitation code not exists')` (400) | `throw new BadRequestException('Invitation code not exists')` |

`httpAdapter.reply()` keeps the filter platform-agnostic: it works the same on Express or
Fastify.

---

## 20. Step 14 — Services and API resources

Controllers delegate to services. Services hold the logic Laravel kept in controllers:

```ts
// src/modules/short-urls/short-urls.service.ts (excerpt)
// Inserts with a random code; the unique index decides collisions, so two
// concurrent requests can never get the same code. Postgres aborts a
// transaction after an error, so each attempt is a new transaction.
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
        await repos.companies.updateTotals(user.companyId, {
          totalUrls: await repos.shortUrls.countByCompany(user.companyId),
        });
        await repos.users.updateTotals(user.id, {
          totalUrls: await repos.shortUrls.countByCreator(user.id),
        });

        return shortUrl;
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;   // QueryFailedError, SQLSTATE 23505
    }
  }
  throw new InternalServerErrorException('Could not generate a unique short code. Please try again.');
}
```

```ts
// Role scoping shared by the list and the CSV export
private companyFilter(user: User, filter: CompanyUrlsFilterDto): ShortUrlFilter {
  return {
    ...createdBetween(filter),
    companyId: user.companyId,
    createdBy: user.type === UserType.Member ? user.id : undefined,
  };
}
```

### API resources (output DTOs)

```ts
// src/modules/short-urls/short-url.resource.ts
export const toCompanyShortUrlResource = (appUrl: string) => (url: ShortUrl) => ({
  id: url.id,
  url: url.url,
  short_url_code: url.shortUrlCode,
  hits: url.hits,
  user: url.creator.name,
  client_id: url.creator.company.id,
  created_at: url.createdAt,
  short_url: shortLink(appUrl, url.shortUrlCode),   // ← $appends
});
```

Plain mapping functions keep the snake_case API contract explicit and allow-listed. Nest's
`ClassSerializerInterceptor` with `@Exclude`/`@Expose` on entities is an alternative, but it
couples the API shape to the entities.

---

## 21. Step 15 — Mail

```ts
// src/modules/mail/mailer.ts
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export const MAILER = Symbol('MAILER');

export class SmtpMailer implements Mailer { /* nodemailer */ }
export class LogMailer implements Mailer { /* Nest Logger → pino */ }
```

```ts
// src/modules/mail/mail.module.ts
// Factory provider: picks the Mailer implementation from configuration.
// Tests swap it with overrideProvider(MAILER).
@Global()
@Module({
  providers: [
    {
      provide: MAILER,
      inject: [mailConfig.KEY],
      useFactory: (config: ConfigType<typeof mailConfig>) =>
        config.mailer === 'smtp' ? new SmtpMailer(config) : new LogMailer(),
    },
  ],
  exports: [MAILER],
})
export class MailModule {}
```

```ts
// consumer
constructor(@Inject(MAILER) private readonly mailer: Mailer) {}
```

- Interfaces don't exist at runtime, so Nest needs an **injection token** (`MAILER` symbol) for
  interface-typed dependencies. Laravel binds interfaces to classes via `$this->app->bind()`.
- Templates are functions that escape every interpolated value (`escapeHtml`), the equivalent
  of Blade's `{{ }}`.
- For production, send mail from a queue (`@nestjs/bullmq`), the Nest equivalent of
  `Mail::queue()`.

---

## 22. Step 16 — Excel export → `StreamableFile`

```ts
// src/modules/short-urls/controllers/csv.ts
// POST endpoint answering 200 with a CSV attachment (no JSON envelope)
export const CsvDownload = (path: string, fileName: string) =>
  applyDecorators(
    Post(path),
    HttpCode(HttpStatus.OK),
    Header('Content-Type', 'text/csv; charset=UTF-8'),
    Header('Content-Disposition', `attachment; filename="${fileName}"`),
  );

// controller
@CsvDownload('download', 'urls.csv')
download(@Body() filter: AllUrlsFilterDto) {
  return new StreamableFile(toCsvStream(CLIENT_EXPORT_HEADINGS, this.shortUrls.exportAll(filter)));
}
```

```ts
// src/common/utils/csv.ts
export const toCsvStream = (headings: string[], rows: AsyncIterable<unknown[]>) => {
  const csv = stringify({ header: true, columns: headings, quoted: true });
  // pipeline destroys `csv` if reading rows fails, which aborts the download
  pipeline(Readable.from(rows), csv, () => undefined);
  return csv;
};
```

Rows come from an async generator reading the database in **keyset-paginated batches**:

```ts
// src/database/repositories/short-urls.repository.ts (excerpt)
async *iterate(filter: ShortUrlFilter, batchSize = 1000): AsyncGenerator<ShortUrl> {
  let last: ShortUrl | undefined;
  while (true) {
    const qb = this.listQuery(filter).limit(batchSize);
    if (last) {
      // Postgres row-value comparison: matches ORDER BY created_at DESC, id DESC
      qb.andWhere('(url.createdAt, url.id) < (:lastCreatedAt, :lastId)', {
        lastCreatedAt: last.createdAt,
        lastId: last.id,
      });
    }
    const batch = await qb.getMany();
    yield* batch;
    if (batch.length < batchSize) return;
    last = batch[batch.length - 1];
  }
}
```

- `StreamableFile` lets Nest stream the response (with error handling), so you don't need
  `@Res()`, which would bypass interceptors and filters.
- Memory stays flat however many rows are exported. Laravel loaded everything with `->get()`.
- The output matches Laravel Excel exactly (quoted fields, same headings, `d M Y` dates); an
  e2e test asserts the CSV lines.

---

## 23. Step 17 — Web routes, health check, bootstrap

### `routes/web.php` → controllers outside the `/api` prefix

```ts
// src/modules/short-urls/controllers/redirect.controller.ts
@Public()
@Controller()
export class RedirectController {
  @Get('s/:code')
  @Redirect()
  async redirect(@Param('code') code: string) {
    const url = await this.shortUrls.resolve(code);
    if (!url) throw new NotFoundException('Short URL not found');
    return { url: absolute(url), statusCode: 302 };
  }

  @Get()
  @Redirect()
  home() {
    return { url: this.app.frontendUrl, statusCode: 302 };
  }
}
```

```ts
// src/configure-app.ts — shared by main.ts and the e2e tests
export function configureApp(app: NestExpressApplication) {
  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  app.set('trust proxy', config.trustProxy);
  app.use(helmet());
  app.enableCors({ origin: config.corsOrigins, exposedHeaders: ['Content-Disposition'] });

  // routes/api.php under /api; routes/web.php stays at the root
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 's/:code', method: RequestMethod.GET },
      { path: 'up', method: RequestMethod.GET },
      { path: '/', method: RequestMethod.GET },
    ],
  });

  // Lets class-validator constraints (IsUnique) receive injected services
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // Close DB connections on SIGTERM / SIGINT
  app.enableShutdownHooks();

  return app;
}
```

### Health check (`/up`)

```ts
@Public()
@Controller('up')
export class HealthController {
  constructor(private readonly health: HealthCheckService, private readonly db: TypeOrmHealthIndicator) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}
// → { "status": "ok", "info": { "database": { "status": "up" } }, ... } or 503
```

### `main.ts`

```ts
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));   // nestjs-pino for framework + app logs
  configureApp(app);

  const config = app.get(appConfig.KEY);
  await app.listen(config.port);
}
await bootstrap();   // top-level await: ESM
```

`enableShutdownHooks()` makes Nest call `onModuleDestroy`/`beforeApplicationShutdown` on
SIGTERM, so TypeORM closes its pool. Nest 12's Express adapter also drains in-flight requests.

---

## 24. Step 18 — Testing

Two layers, following Nest conventions:

### Unit tests (`src/**/*.spec.ts`): no database

```ts
// src/modules/auth/auth.service.spec.ts (excerpt)
const module = await Test.createTestingModule({
  providers: [
    AuthService,
    { provide: UsersRepository, useValue: users },          // vi.fn() mocks
    { provide: PasswordHasher, useValue: hasher },
    { provide: AccessTokenService, useValue: accessTokens },
  ],
}).compile();
service = module.get(AuthService);
```

| File | Covers |
|---|---|
| `common/pipes/validation.pipe.spec.ts` | Laravel messages, one error per field, trimming, whitelisting, pagination fallbacks |
| `modules/auth/access-token.service.spec.ts` | Token format, hashing, prefix/no-prefix verification, forged/expired/revoked tokens |
| `modules/auth/auth.service.spec.ts` | Login success, wrong email/password → 403 |
| `common/utils/utils.spec.ts` | Pagination meta, date formatting, random strings, HTML escaping |

### E2E tests (`test/*.e2e-spec.ts`): the whole app plus a real Postgres

```ts
// test/helpers.ts (excerpt)
const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
  .overrideProvider(MAILER)          // Mail::fake()
  .useValue(mailer)
  .compile();

const app = configureApp(moduleRef.createNestApplication<NestExpressApplication>({ logger: false }));
await app.init();
const api = () => request(app.getHttpServer());
```

```ts
// vitest.config.e2e.ts
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    include: ['test/**/*.e2e-spec.ts'],
    env: parse(readFileSync('.env.test')),            // → url_shortener_test
    globalSetup: ['test/setup/global-setup.ts'],      // npm run migration:run
    fileParallelism: false,                           // suites share one database
  },
});
```

| Suite | Covers |
|---|---|
| `auth.e2e-spec.ts` | Login/token format, 403 credentials, 422 messages, `/user`, logout revokes, forged tokens, 404 + malformed JSON envelope |
| `authorization.e2e-spec.ts` | Role matrix, 401 before 403, **403 before 422** |
| `short-urls.e2e-spec.ts` | Generate + totals, validation, scoping, pagination, filters, CSV format, redirect hit counting, `/up` |
| `invitations.e2e-spec.ts` | Client and team flows, single-use codes, unique-email + other errors together, mail failure 403 |

| Laravel testing | NestJS testing |
|---|---|
| `$this->mock(Service::class)` | `{ provide: Service, useValue: mock }` in `createTestingModule` |
| `Mail::fake()` | `.overrideProvider(MAILER).useValue(fakeMailer)` |
| `RefreshDatabase` | `TRUNCATE … RESTART IDENTITY CASCADE` per test |
| `$this->postJson()` | `request(app.getHttpServer()).post()` |
| `actingAs($user, 'sanctum')` | Log in and send `Authorization: Bearer …` (or override `AccessTokenGuard`) |

> **Vitest and decorator metadata:** Nest's DI reads constructor parameter types from
> `emitDecoratorMetadata`. The Nest 12 Vitest setup supports it, so constructor injection works
> in tests without extra plugins. The scaffold's sample test checks this.

---

## 25. NestJS vs Express port

Same contract, different structure:

| Concern | Express port | NestJS port |
|---|---|---|
| Wiring | Hand-written composition root (`container.ts`) | IoC container + modules |
| ORM | Prisma 7 (schema file, generated client) | TypeORM 1 (decorated entities) |
| Validation | Zod schemas + `validate()` middleware | DTO classes + class-validator + global pipe |
| Unique email | Checked in the service (reported after other errors) | `@IsUnique` async validator (reported **with** other errors) |
| Auth | `authenticate` middleware per router | Global guard + `@Public()` (secure by default) |
| Roles | `authorize(...)` middleware | `@Roles()` metadata + `RolesGuard` |
| Envelope | `sendSuccess(res, msg, data)` in each controller | Return data; interceptor wraps it |
| Errors | Error middleware | Exception filter |
| CSV | `pipeline(..., res)` | `StreamableFile` |
| Rate limit | `express-rate-limit`, failed attempts only | `@nestjs/throttler`, all attempts |
| Health | Hand-written `/up` | `@nestjs/terminus` |
| Tests | Vitest + Supertest | Vitest unit (`Test.createTestingModule`) + e2e (`overrideProvider`) |
| Lines of glue | More (you build the framework) | Less (the framework provides it) |

Pick **NestJS** for larger teams and long-lived codebases that benefit from enforced structure
(the closest match to Laravel's conventions). Pick **Express** (or Fastify/Hono) when you want
minimal abstraction and full control.

---

## 26. Bugs fixed and behaviour changes

Same fixes as the Express port, plus Nest-specific ones:

| # | Laravel | NestJS |
|---|---|---|
| 1 | `short_url_code` not unique/indexed; duplicates and full scans possible | Unique index; insert-and-retry on SQLSTATE 23505 |
| 2 | Multi-write operations not transactional | `UnitOfWork` transactions (register, generate, redirect counters) |
| 3 | Registration used the **posted** email | Account created for the **invited** email |
| 4 | `www.example.com` links redirected onto the API host | Scheme added before redirecting |
| 5 | No login throttling | `@nestjs/throttler`, 10 requests/min/IP (configurable) |
| 6 | `per_page` unbounded | Capped at 100 |
| 7 | Exports loaded all rows into memory | Streamed in keyset batches |
| 8 | Routes public unless `auth:sanctum` added | Protected unless `@Public()` |
| 9 | Unknown fields passed through `$request->all()` in places | `whitelist: true` strips them |
| 10 | Debug-mode errors leaked stack traces | Uniform envelope; internals hidden in production |
| 11 | `url` limited to 255 chars | `text` |

Unchanged on purpose: endpoints, methods (all `POST`, status **200**), field names, messages,
status codes, token format, CSV format, `is_global` as `0/1`.

---

## 27. Pitfalls to watch for

Some of these were hit while building the port (Nest 12 defaults, TypeORM 1.0 API changes,
the audit findings, the Docker hang); the others are known traps that the code is written to
avoid up front.

| Problem | Cause | Fix |
|---|---|---|
| Tutorials don't match the scaffold | Nest 12 defaults: ESM, Vitest, oxlint, TS 6 | Follow the new defaults; `.js` import extensions |
| TypeORM 1.0 API differences | `exist()`, string-array `select`/`relations` removed; `null`/`undefined` in `where` throws | `existsBy`, object syntax, only add defined conditions |
| "Cannot access 'Company' before initialization" | ESM + decorator metadata + circular entity imports | `Relation<Company>` property types |
| "Data type Object … not supported" in CLI/seed | `tsx`/esbuild doesn't emit decorator metadata | Explicit `type` on every `@Column` |
| Migrations glob loaded `.d.ts` files from `dist` | `*.{ts,js}` matches declaration files | Pick the extension from `import.meta.url` |
| Keyset pagination skipped/duplicated rows | Postgres `timestamptz` µs vs JS ms | `precision: 3` on timestamp columns |
| Every POST returned 201 | Nest default for `@Post()` | `@HttpCode(200)` in the `@PostAction` decorator |
| Pagination fields disappeared | `whitelist: true` strips properties without validators | `@IsInt()` on `page`/`per_page` |
| `@IsUnique` couldn't inject `DataSource` | class-validator instantiates constraints itself | `useContainer(app.select(AppModule), { fallbackOnErrors: true })` |
| Interceptor broke redirects and CSV | Wrapping every handler | Wrap only handlers with `@ResponseMessage` metadata |
| `extends Repository<T>` broke in transactions | `withRepository` re-instantiates with `(target, manager)` | Composition-based `BaseRepository.withManager()` |
| `npm audit`: 5 vulnerabilities | Scaffold's `@nestjs/mau` dev dependency | Removed (unused); 0 vulnerabilities |
| Docker daemon hung under heavy load during setup | Host issue, not project-related | Restart Docker Desktop |

---

## 28. Interview questions and answers

### NestJS core

**1. What is NestJS and how does it relate to Express?**
A framework for server-side Node apps built on top of an HTTP platform: Express by default,
Fastify optionally. It adds an IoC container, modules, decorators for routing and metadata,
and a request pipeline (middleware → guards → interceptors → pipes → handler → filters).
Laravel developers recognise the structure.

**2. Explain modules. What do `imports`, `exports`, `providers` and `controllers` mean?**
`providers` are injectable classes the module's container can create; `controllers` handle
routes; `exports` make providers available to modules that `imports` this module. Providers
are private unless exported, which enforces boundaries. `@Global()` modules (config,
database, mail here) don't need importing.

**3. How does dependency injection work in Nest?**
Classes marked `@Injectable()` are registered as providers. Nest reads constructor parameter
types from `emitDecoratorMetadata` and resolves them from the module scope. Tokens can be a
class, a string/symbol (`MAILER`), or a config key (`appConfig.KEY`) with `@Inject(token)`.
Providers are singletons by default; `Scope.REQUEST` and `Scope.TRANSIENT` exist (request
scope bubbles up the dependency chain and has a performance cost).

**4. Name the kinds of custom providers.**
`useClass` (swap an implementation), `useValue` (constants or mocks), `useFactory` (build from
other providers or config, can be async; used for `MAILER`, `APP_FILTER`, TypeORM),
`useExisting` (alias). The Laravel equivalents are `bind`, `instance`, closures and `alias`.

**5. Middleware vs guards vs interceptors vs pipes vs filters?**
- **Middleware:** raw req/res before routing (helmet, CORS, logging); doesn't know the handler.
- **Guards:** decide **whether** the handler runs (`canActivate`); know the handler via
  `ExecutionContext` (auth, roles, throttling).
- **Interceptors:** wrap execution before and after (RxJS); transform results, add timing,
  caching (the response envelope).
- **Pipes:** transform or validate **arguments** (`ValidationPipe`, `ParseIntPipe`).
- **Exception filters:** turn thrown exceptions into responses.

**6. What is the execution order of these?**
Middleware → guards (global → controller → route) → interceptors (before) → pipes → handler →
interceptors (after) → exception filters (when something throws). This is why a forbidden
user gets 403 before their invalid body could produce 422.

**7. `APP_GUARD` provider vs `app.useGlobalGuards()`?**
`APP_GUARD` (and `APP_PIPE`/`APP_INTERCEPTOR`/`APP_FILTER`) registers the global enhancer as a
provider: it gets DI and is included in testing modules. `useGlobal*()` creates instances
outside the container: no injection, and you must repeat the call in tests.

**8. How do custom decorators and `Reflector` work?**
Decorators attach metadata to classes or handlers; guards and interceptors read it with
`Reflector`. Nest 12 recommends `Reflector.createDecorator<T>()` for typed keys (`@Roles`,
`@ResponseMessage`); `SetMetadata` still works (`@Public`). `applyDecorators()` composes several
(`@PostAction`); `createParamDecorator()` builds argument decorators (`@CurrentUser`).

**9. How do you make all routes protected by default?**
Register an auth guard globally (`APP_GUARD`) and add an `@Public()` metadata decorator that
the guard checks with `reflector.getAllAndOverride(IS_PUBLIC_KEY, [handler, class])`.

**10. How does validation work, and what do `whitelist` and `transform` do?**
`ValidationPipe` turns the plain body into a DTO instance (class-transformer) and validates
decorators (class-validator). `whitelist` strips undeclared properties (mass-assignment
protection), `forbidNonWhitelisted` rejects them instead, `transform` passes the instance
(with `@Transform` results) to the handler. Nest 12 can also validate with Standard Schema
(Zod/Valibot/ArkType) via `@Body({ schema })`.

**11. How do you write an async validator that queries the database?**
Implement `ValidatorConstraintInterface` with `async validate()`, mark it `@Injectable()`
and `@ValidatorConstraint({ async: true })`, register it as a provider, create a decorator with
`registerDecorator`, and call `useContainer(app.select(AppModule), { fallbackOnErrors: true })`
so class-validator resolves it from Nest (this project's `@IsUnique`).

**12. How would you return a file or stream?**
Return `new StreamableFile(stream | Buffer)` and set headers with `@Header()`. Avoid `@Res()`:
it bypasses interceptors and filters unless you use `passthrough: true`.

**13. What are lifecycle hooks and why does `enableShutdownHooks()` matter?**
`onModuleInit`, `onApplicationBootstrap`, `onModuleDestroy`, `beforeApplicationShutdown`,
`onApplicationShutdown`. Shutdown hooks only fire on signals if `enableShutdownHooks()` is called,
which lets TypeORM close pools and workers finish jobs. Nest 12 invokes hooks by
component-hierarchy level.

**14. How do you handle configuration?**
`ConfigModule.forRoot({ load: [registerAs(...)], validate })`, then inject typed namespaces
with `@Inject(appConfig.KEY) cfg: ConfigType<typeof appConfig>`. Validate at boot (class-validator,
Joi or any Standard Schema) and keep secrets in env vars.

**15. What changed in NestJS 12?**
All packages ship as ESM (CommonJS apps keep working through `require(esm)`), new projects use
Vitest, oxlint and Rspack, Standard Schema validation in route decorators, `Reflector.createDecorator`
in schematics, hierarchical lifecycle-hook ordering, structured `ConsoleLogger` params, and
graceful request draining in the Express adapter. Node 20.19+/22.12+ required. `nest upgrade`
automates most of the migration.

### Data layer (TypeORM and PostgreSQL)

**16. TypeORM vs Eloquent?**
Eloquent is Active Record (`$user->save()`). TypeORM supports both Active Record
(`BaseEntity`) and **Data Mapper** (repositories/EntityManager, used here). Relations load
explicitly via `relations` or joins (no lazy-loading magic by default), and migrations can be
generated from entity diffs.

**17. What changed in TypeORM 1.0?**
Global helpers (`getRepository`, `createConnection`…) removed in favour of `DataSource`;
string-array `select`/`relations` removed; `exist()`, `findByIds()`, `findOneById()` removed;
`null`/`undefined` in `where` now throws (use `IsNull()`); required relations use INNER JOIN;
`readonly` → `update: false`; Node 20+. A codemod (`npx @typeorm/codemod v1 src/`) automates
most of it.

**18. Why never use `synchronize: true` in production?**
It alters the schema to match entities on startup, which can drop columns and data and isn't
reviewable. Use generated migrations, review the SQL, and run them in the release step.

**19. How do transactions work with repositories here?**
`dataSource.transaction(manager => …)` provides a transactional `EntityManager`; each custom
repository creates a copy bound to it (`withManager`). The `UnitOfWork` hands those copies to the
service callback, so everything commits or rolls back together.

**20. How do you avoid N+1 queries in TypeORM?**
Load relations in the same query (`relations: { creator: { company: true } }` or
`innerJoinAndSelect`), avoid querying inside loops, use `In()` for batches, aggregate in SQL. The
lists here use one joined query plus one count.

**21. Offset vs keyset pagination?**
The UI uses offset (page numbers). Exports use keyset with Postgres row comparison
`(created_at, id) < (:createdAt, :id)`, which stays fast on deep pages and is stable while
rows are being added.

**22. How do you handle unique-constraint races?**
Let the database enforce uniqueness, attempt the insert, and catch `QueryFailedError` with
SQLSTATE `23505` to retry (new transaction, because Postgres aborts the current one after an
error).

**23. Why a custom repository class instead of `@InjectRepository()` directly in services?**
Both are valid. Custom classes centralise query logic, make services easy to mock, and support
transaction rebinding. For tiny apps, `@InjectRepository(Entity)` in the service is fine.

### Security and operations

**24. How is authentication implemented and why not Passport/JWT?**
Opaque Sanctum-compatible tokens: random value shown once, SHA-256 stored, constant-time
compare, revocable on logout. `@nestjs/passport` + `passport-jwt` (or `@nestjs/jwt`) is common
for stateless JWTs, but revocation is harder and the existing frontends already speak Sanctum's
format.

**25. How do you rate-limit in Nest?**
`@nestjs/throttler`: configure throttlers in `ThrottlerModule.forRoot[Async]`, apply
`ThrottlerGuard` globally or per route, override with `@Throttle()`/`@SkipThrottle()`. Use a
Redis storage when running several instances, and set `trust proxy` behind load balancers.

**26. How do you structure error responses consistently?**
One global exception filter (`@Catch()`) that maps known exceptions to the API's envelope, maps
framework/library errors (validation, throttling, router 404, body-parser), and hides unknown
errors in production while logging them.

**27. How do you test a Nest app?**
Unit tests with `Test.createTestingModule({ providers: [Service, { provide: Dep, useValue: mock }] })`;
e2e tests that import `AppModule`, override providers (`overrideProvider(MAILER)`), apply the
same `configureApp`, and drive HTTP with Supertest against a dedicated test database.

**28. How do you add logging and request IDs?**
`nestjs-pino` (`LoggerModule.forRoot`) adds a request-scoped child logger with an id per request,
redacts headers, and replaces Nest's logger via `app.useLogger(app.get(Logger))` with
`bufferLogs: true` so bootstrap logs aren't lost.

**29. How would you add background jobs and scheduled tasks?**
`@nestjs/bullmq` for queues (`@Processor`, `WorkerHost`) and `@nestjs/schedule` for cron
(`@Cron()`), the counterparts of Laravel queues and the scheduler.

**30. How would you document the API?**
`@nestjs/swagger`: decorate DTOs/controllers (or use the CLI plugin to infer them) and serve
`SwaggerModule.setup('docs', app, document)`.

### Comparison questions

**31. Laravel vs NestJS: when would you pick each?**
Laravel: fastest path to a full-stack PHP product with batteries included (Eloquent, queues,
Horizon, Blade/Inertia, a mature ecosystem). NestJS: a TypeScript-everywhere team (shared types
with Nuxt/Next), high-concurrency I/O workloads, microservices/WebSockets/GraphQL in one
framework, and structure similar to Laravel's for large teams.

**32. How do FormRequests map to Nest?**
`authorize()` → a guard (role metadata); `rules()` → DTO decorators + `ValidationPipe`;
`messages()` → decorator `message` options; `prepareForValidation()` → `@Transform`;
`validated()` → the whitelisted DTO instance.

**33. How do service providers and facades map?**
Providers → modules and custom providers; `bind`/`singleton` → provider scopes; facades →
constructor-injected services (no static proxies, which makes dependencies visible and mocks
trivial).

**34. What would you watch for when running Nest in production?**
Run migrations in the release step (`migration:run:prod`), `NODE_ENV=production`, JSON logs,
health checks for the orchestrator (`/up`), graceful shutdown, shared stores for throttling and
cache, connection-pool sizing (plus PgBouncer for many instances), and queues for slow work (mail).

**35. How would you share types between the Nest API and the Nuxt/Next frontends?**
Extract DTO/resource types (or Zod schemas) into a shared workspace package in a monorepo, or
generate a typed client from the OpenAPI spec (`@nestjs/swagger` + `openapi-typescript`).

---

## 29. Migration checklist

- [ ] Write down the API contract (routes, fields, envelope, status codes, messages, token format, exports)
- [ ] `nest new` (ESM, Vitest, oxlint); install TypeORM, config, throttler, terminus, pino, class-validator
- [ ] Audit dependencies; drop unused scaffold tooling
- [ ] Postgres in Docker (+ test DB)
- [ ] Config namespaces with `registerAs` + env validation
- [ ] Entities (explicit column types, `Relation<>`, indexes, enums, `select: false` for secrets)
- [ ] Shared TypeORM options + CLI data source; generate and review the initial migration
- [ ] Repositories + `UnitOfWork` in a global persistence module
- [ ] Seeder + factories
- [ ] Global pipeline: `AccessTokenGuard`, `RolesGuard`, `ValidationPipe`, envelope interceptor, exception filter
- [ ] Decorators: `@Public`, `@Roles`, `@PostAction`, `@CurrentUser`
- [ ] Laravel-compatible validation decorators, `@IsUnique` (with `useContainer`), `@SameAs`
- [ ] Feature modules: DTOs → service → controller → resource
- [ ] Mail provider (strategy + factory), CSV `StreamableFile`, redirect + health outside `/api`
- [ ] `configureApp()` shared by `main.ts` and e2e tests; shutdown hooks
- [ ] Unit specs (mocks) + e2e specs (real DB, overridden mailer)
- [ ] Contract check against the Laravel API; click through the frontends
- [ ] Production: build, `migration:run:prod`, env, logs, health, graceful shutdown
