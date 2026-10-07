# URL Shortener (Laravel API + Nuxt)

A URL shortener with **Laravel 12** as the backend API and **Nuxt 4** as the frontend.
It is a port of [rkumwt/url-shortner](https://github.com/rkumwt/url-shortner): the
Laravel app is unchanged apart from removing the bundled Vue SPA, and the Vue SPA has
been rebuilt as a standalone Nuxt app (Ant Design Vue + Pinia).

```
backend/   Laravel API (Sanctum bearer tokens), short-link redirects at /s/{code}
frontend/  Nuxt SPA (ssr: false), talks to the API over CORS
```

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

## Frontend

```bash
cd frontend
npm install
cp .env.example .env         # NUXT_PUBLIC_API_BASE=http://localhost:8000/api
npm run dev                  # http://localhost:3000
```

Production build: `npm run build` then `node .output/server/index.mjs`, or
`npm run generate` for static hosting (serve with an SPA fallback to `index.html`).

## Roles

| Role       | Pages                                                      |
|------------|------------------------------------------------------------|
| superadmin | Clients (invite clients), all short URLs, filter by client |
| admin      | Company short URLs (generate, filter, CSV), team members   |
| member     | Own short URLs (generate, filter, CSV)                     |
