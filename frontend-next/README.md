# URL Shortener — Next.js frontend

Next.js 16 (App Router) + Ant Design 6 + Zustand port of the Nuxt frontend in
[`../frontend`](../frontend). See the [root README](../README.md) for backend setup and
[`../NUXT_VUE_TO_NEXTJS_MIGRATION.md`](../NUXT_VUE_TO_NEXTJS_MIGRATION.md) for how it was converted.

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_BASE points to the Laravel API
npm run dev                  # http://localhost:3001
```

The backend must allow this origin: set
`CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001` in `backend/.env`.

`NEXT_PUBLIC_*` variables are inlined at build time, so rebuild after changing them.
