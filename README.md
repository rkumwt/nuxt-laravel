# URL Shortener (Laravel API + Nuxt)

A URL shortener with three interchangeable backend APIs, **Laravel 12** (MySQL),
**Express 5** and **NestJS 12** (both PostgreSQL), and two interchangeable frontends,
**Nuxt 4** and **Next.js 16**. It is a port of
[rkumwt/url-shortner](https://github.com/rkumwt/url-shortner): the Laravel app is
unchanged apart from removing the bundled Vue SPA, which has been rebuilt as a
standalone Nuxt app (Ant Design Vue + Pinia) and then as a Next.js app (Ant Design + Zustand).

```
backend/        Laravel API (Sanctum bearer tokens), short-link redirects at /s/{code}, port 8000
backend-express/ Express + TypeScript + Prisma + PostgreSQL port of the same API, port 8001
backend-nestjs/  NestJS + TypeORM + PostgreSQL port of the same API, port 8002
frontend/       Nuxt SPA (ssr: false), port 3000
frontend-next/  Next.js App Router, port 3001
```

Guides: [Vue → Nuxt](VUE_TO_NUXT_MIGRATION.md) · [Nuxt/Vue → Next.js](NUXT_VUE_TO_NEXTJS_MIGRATION.md) ·
[Laravel → Express](LARAVEL_TO_EXPRESS_MIGRATION.md) · [Laravel → NestJS](LARAVEL_TO_NESTJS_MIGRATION.md)

## Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Set the database credentials in `.env` (MySQL by default; for SQLite set
`DB_CONNECTION=sqlite` and `touch database/database.sqlite`), plus:

```
APP_URL=http://localhost:8000        # used to build short URLs (APP_URL/s/{code})
FRONTEND_URL=http://localhost:3000   # used for invite links and CORS
# To run both frontends, allow both origins:
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

Then:

```bash
php artisan migrate
php artisan db:seed
php artisan serve            # http://localhost:8000
```

> With `APP_ENV=production` the seeder only creates the superadmin
> (`superadmin@example.com` / `12345678`). With `APP_ENV=local` it also creates
> demo companies, `admin@example.com` and `member@example.com` (same password) and sample URLs.

Configure mail in `.env` to send invitation emails (e.g. Mailtrap), or use
`MAIL_MAILER=log` to write them to `storage/logs/laravel.log`.

## Backend (Express, alternative)

```bash
cd backend-express
npm install && cp .env.example .env
npm run db:up && npm run db:deploy && npm run db:seed
npm run dev                  # http://localhost:8001
```

Point a frontend at it with `NUXT_PUBLIC_API_BASE` / `NEXT_PUBLIC_API_BASE=http://localhost:8001/api`.
See [backend-express/README.md](backend-express/README.md).

## Backend (NestJS, alternative)

```bash
cd backend-nestjs
npm install && cp .env.example .env
npm run db:up && npm run migration:run && npm run db:seed
npm run start:dev            # http://localhost:8002
```

Point a frontend at it with `NUXT_PUBLIC_API_BASE` / `NEXT_PUBLIC_API_BASE=http://localhost:8002/api`.
See [backend-nestjs/README.md](backend-nestjs/README.md).

## Frontend

```bash
cd frontend
npm install
cp .env.example .env         # NUXT_PUBLIC_API_BASE=http://localhost:8000/api
npm run dev                  # http://localhost:3000
```

Production build: `npm run build` then `node .output/server/index.mjs`, or
`npm run generate` for static hosting (serve with an SPA fallback to `index.html`).

## Frontend (Next.js)

```bash
cd frontend-next
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_BASE=http://localhost:8000/api
npm run dev                  # http://localhost:3001
```

Production: `npm run build && npm start`. Invite emails link to `FRONTEND_URL`, so point
it at whichever frontend you deploy.

## Roles

| Role       | Pages                                                      |
|------------|------------------------------------------------------------|
| superadmin | Clients (invite clients), all short URLs, filter by client |
| admin      | Company short URLs (generate, filter, CSV), team members   |
| member     | Own short URLs (generate, filter, CSV)                     |
