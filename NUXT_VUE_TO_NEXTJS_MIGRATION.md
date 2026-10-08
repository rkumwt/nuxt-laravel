# Migrating from Vue / Nuxt to React / Next.js — A Practical Guide

This guide converts the **URL Shortener** frontend from **Nuxt 4 (Vue 3)** in `frontend/`
to **Next.js 16 (React 19, App Router)** in `frontend-next/`. The same Laravel API in
`backend/` serves both.

It assumes you know Vue/Nuxt (see [VUE_TO_NUXT_MIGRATION.md](VUE_TO_NUXT_MIGRATION.md))
and teaches the React/Next equivalents by porting real code, file by file. The guide ends
with built-in components, core concepts and interview questions.

| | Nuxt app | Next app |
|---|---|---|
| Framework | Nuxt 4 | Next.js 16.4 (App Router, Turbopack) |
| UI library | Vue 3.5 | React 19 |
| Components | Ant Design Vue 4 | Ant Design 6 (`antd`) |
| State | Pinia | Zustand |
| HTTP | `$fetch` (ofetch) | `fetch` wrapper |
| Dev port | 3000 | 3001 |

---

## Table of Contents

1. [Mental model shift: Vue → React](#1-mental-model-shift-vue--react)
2. [Concept map: Vue / Nuxt → React / Next](#2-concept-map-vue--nuxt--react--next)
3. [Architecture and file map](#3-architecture-and-file-map)
4. [Step 1 — Create the Next.js project](#4-step-1--create-the-nextjs-project)
5. [Step 2 — Configuration and environment variables](#5-step-2--configuration-and-environment-variables)
6. [Step 3 — Server vs Client Components (the big new idea)](#6-step-3--server-vs-client-components)
7. [Step 4 — Root layout and providers (replaces `app.vue` + plugins)](#7-step-4--root-layout-and-providers)
8. [Step 5 — HTTP layer: `$fetch.create` → `fetch` wrapper](#8-step-5--http-layer)
9. [Step 6 — Composables → custom hooks](#9-step-6--composables--custom-hooks)
10. [Step 7 — Pinia → Zustand](#10-step-7--pinia--zustand)
11. [Step 8 — Routing: `pages/` → `app/`](#11-step-8--routing-pages--app)
12. [Step 9 — Layouts: `layouts/` → `layout.tsx` + route groups](#12-step-9--layouts)
13. [Step 10 — Route middleware → `AuthGuard` (and why not `proxy.ts`)](#13-step-10--route-middleware--authguard)
14. [Step 11 — Templates → JSX, component by component](#14-step-11--templates--jsx)
15. [Step 12 — Ant Design Vue → Ant Design (React)](#15-step-12--ant-design-vue--ant-design-react)
16. [Pitfalls hit during this migration](#16-pitfalls-hit-during-this-migration)
17. [Next.js built-in components and file conventions](#17-nextjs-built-ins)
18. [Next.js concepts reference](#18-nextjs-concepts-reference)
19. [Interview questions and answers](#19-interview-questions-and-answers)
20. [Migration checklist](#20-migration-checklist)

---

## 1. Mental model shift: Vue → React

The biggest change is **how reactivity works**.

| Vue | React |
|---|---|
| **Fine-grained reactivity.** `ref()` returns a mutable proxy; Vue tracks who reads it and re-runs only those effects or parts of the template. | **Re-render on state change.** `useState()` returns a value and a setter. Calling the setter re-runs the **whole component function**, and React diffs the output. |
| `setup()` / `<script setup>` runs **once** per component instance. | The component function runs on **every render**. Anything that must survive renders goes in a hook (`useState`, `useRef`, `useMemo`). |
| You **mutate**: `form.value.email = 'x'`. | You **replace**: `setForm({ ...form, email: 'x' })`. State is treated as immutable. |
| Templates (HTML + directives) compiled to render functions. | JSX: JavaScript expressions that produce elements. No directives; you use `&&`, ternaries and `.map()`. |
| Two-way binding with `v-model`. | One-way data flow: `value` + `onChange`. |
| Child-to-parent events with `emit('success')`. | The parent passes a **callback prop**: `onSuccess={reload}`. |
| Slots (`<slot/>`, named slots, scoped slots). | `children`, props that hold JSX, render functions. |
| `watch(source, cb)` | `useEffect(cb, [deps])`, or computing the value during render. |
| `computed(() => …)` | Compute inline during render; use `useMemo` only when it's expensive. |
| `onMounted` / `onUnmounted` | `useEffect(() => { …; return cleanup }, [])` |

**Rules of Hooks** (no Vue equivalent; interviewers ask about these):
1. Call hooks only at the **top level** of a component or another hook. Never inside
   conditions, loops or callbacks.
2. Call hooks only from **React functions** (components or custom hooks named `useX`).

React identifies each piece of state by the **order** of hook calls, so the order must
be the same on every render.

---

## 2. Concept map: Vue / Nuxt → React / Next

### Vue → React

| Vue 3 | React 19 | Example in this project |
|---|---|---|
| `ref(0)` | `useState(0)` | `const [open, setOpen] = useState(false)` |
| `reactive({...})` | `useState({...})` with spread updates | `setFormData({ ...formData, name })` |
| `computed(() => a + b)` | `const c = a + b` (or `useMemo`) | `const params = { ...dateRange, ...(clientId ? { company_id: clientId } : {}) }` |
| `watch(() => props.clientId, load)` | `useEffect(load, [clientId])` | `useDatatable` refetches when `url`/`params` change |
| `onMounted(fn)` | `useEffect(fn, [])` | `AuthBootstrap` runs `init()` once |
| template `ref="el"` | `useRef()` + `ref={el}` | — |
| `v-if` / `v-else` | `cond ? <A/> : <B/>`, `cond && <A/>` | `{user?.type === "admin" && <Link…/>}` |
| `v-for="x in list" :key` | `list.map(x => <Item key={x.id}/>)` | antd Table does this internally (`rowKey="id"`) |
| `v-model:value="form.email"` | `value={form.email} onChange={e => …}` | every form input |
| `v-show` | `style={{ display: cond ? undefined : 'none' }}` | — |
| `@click="fn"` | `onClick={fn}` | |
| `@pressEnter` | `onPressEnter` | antd `Input` |
| `:prop="x"` | `prop={x}` | |
| `class` / `:class` | `className` (string) | `className="menu-link"` |
| `style="padding: 0"` | `style={{ padding: 0 }}` (object, camelCase) | |
| `defineProps<{ clientId?: string }>()` | `function C({ clientId }: { clientId?: string })` | `ShortUrls` |
| `defineEmits(['success'])` + `emit('success')` | `onSuccess?: () => void` prop + `onSuccess?.()` | `GenerateUrl` |
| default `<slot/>` | `children` | `AppLayout({ children })` |
| named slot `#extra` | prop with JSX: `extra={<Button/>}` | `PageHeader extra={…}` |
| scoped slot `#bodyCell="{ column, record }"` | render function: `render: (_, record) => …` | Table columns |
| `<Teleport>` | `createPortal` | (antd Modal handles it) |
| `provide` / `inject` | Context (`createContext` / `useContext`) | antd `App.useApp()` uses context |
| `<KeepAlive>` | none built in (keep components mounted / store state) | — |
| `<Transition>` | CSS or libraries (Framer Motion), View Transitions API | — |
| `h(Icon)` | `<Icon />` (JSX) | `icon: <ExclamationCircleOutlined />` |
| `nextTick()` | `flushSync` / effects | — |
| Composable `useX()` | Custom hook `useX()` | `useApiRequest`, `useDatatable`, `useDownload` |
| Pinia | Zustand / Redux Toolkit / Context | `useAuthStore` (Zustand) |

### Nuxt → Next

| Nuxt 4 | Next.js 16 (App Router) |
|---|---|
| `nuxt.config.ts` | `next.config.ts` |
| `app/pages/` | `src/app/` (folders = segments, `page.tsx` = route) |
| `pages/index.vue` | `app/page.tsx` |
| `pages/invite/[code].vue` | `app/invite/[code]/page.tsx` |
| `pages/[...slug].vue` | `app/[...slug]/page.tsx` |
| `layouts/default.vue` + `definePageMeta({ layout })` | nested `layout.tsx` files + **route groups** `(dashboard)` |
| `app.vue` | `app/layout.tsx` (root layout, must render `<html><body>`) |
| `<NuxtPage/>` / `<slot/>` in layout | `{children}` in `layout.tsx` |
| `<NuxtLink>` | `<Link>` from `next/link` |
| `navigateTo()` | `useRouter().push()` / `replace()` (client), `redirect()` (server) |
| `useRoute().params` | `params` prop (async in Next 16) or `useParams()` (client) |
| `useRoute().query` | `searchParams` prop (async) or `useSearchParams()` |
| `definePageMeta({ middleware })` | `proxy.ts` (server, formerly `middleware.ts`) or a client guard component |
| `middleware/*.global.ts` | `proxy.ts` at project root (or `src/`) |
| `plugins/*.ts` | a client `Providers` component in the root layout, `instrumentation-client.ts` |
| auto-imports | **none**: import everything explicitly |
| `components/` auto-registered | import components by path (`@/components/...`) |
| `runtimeConfig.public.apiBase` + `NUXT_PUBLIC_*` | `process.env.NEXT_PUBLIC_*` (**inlined at build time**) |
| `useHead` / `useSeoMeta` | `export const metadata` / `generateMetadata()` |
| `app.head.title` | `metadata.title` (with `template`) in root layout |
| `useFetch` / `useAsyncData` | `async` Server Components + `fetch`, or client fetching (SWR / TanStack Query) |
| `server/api/*.ts` (Nitro) | `app/api/**/route.ts` (Route Handlers), Server Actions |
| `error.vue` / `<NuxtErrorBoundary>` | `error.tsx` / `global-error.tsx` |
| `<NuxtLoadingIndicator>` / lazy pending state | `loading.tsx` / `<Suspense>` |
| `ssr: false` | no global switch: mark components `"use client"` and fetch in effects |
| `routeRules` (`prerender`, `swr`, `isr`) | static by default, `revalidate`, `"use cache"` (Cache Components), dynamic APIs |
| `<ClientOnly>` | `"use client"` + render after mount, or `dynamic(() => import(…), { ssr: false })` |
| `useState` (SSR-safe shared state) | Context / store created per request |
| `nuxi typecheck` | `next typegen` + `tsc --noEmit` |
| `nuxt build` / `nuxt generate` | `next build` / `output: 'export'` |

---

## 3. Architecture and file map

The request flow doesn't change. Only the frontend framework and its port do:

```
Browser ──► Next.js (:3001)  — UI, routing, client-side auth guard
   │
   └──(fetch + Bearer token, CORS)──► Laravel (:8000) /api/*, /s/{code}
```

### Final Next.js tree

```
frontend-next/
├── next.config.ts
├── .env.example / .env.local        # NEXT_PUBLIC_API_BASE
├── AGENTS.md                        # managed by `next dev` (points agents at bundled docs)
└── src/
    ├── app/
    │   ├── layout.tsx               # root layout: <html>, metadata, AntdRegistry, Providers
    │   ├── globals.css
    │   ├── page.tsx                 # /            (login)
    │   ├── invite/[code]/page.tsx   # /invite/:code
    │   └── (dashboard)/             # route group: shared layout, no URL segment
    │       ├── layout.tsx           # AuthGuard requireAuth + AppLayout (header)
    │       ├── admin/dashboard/page.tsx
    │       ├── admin/team-members/page.tsx
    │       ├── superadmin/dashboard/page.tsx
    │       ├── superadmin/urls/page.tsx
    │       └── superadmin/urls/[client_id]/page.tsx
    ├── components/
    │   ├── Providers.tsx            # ConfigProvider, App, auth bootstrap
    │   ├── PageHeader.tsx           # replacement for removed antd PageHeader
    │   ├── auth/      AuthGuard.tsx, LoginForm.tsx, InviteRegister.tsx
    │   ├── layout/    AppLayout.tsx, AdminMenus.tsx, SuperadminMenus.tsx, Logout.tsx
    │   ├── admin/     ShortUrls.tsx, GenerateUrl.tsx, TeamMembers.tsx, TeamMemberInvite.tsx
    │   └── superadmin/Clients.tsx, ClientInvite.tsx, ShortUrls.tsx
    ├── hooks/         useApiRequest.ts, useDatatable.ts, useDownload.ts
    ├── lib/           api.ts, notify.ts, homeRoute.ts, rangePresets.ts, storageKeys.ts
    └── stores/        auth.ts       # Zustand
```

### File-by-file map (Nuxt → Next)

| Nuxt (`frontend/app/…`) | Next (`frontend-next/src/…`) | Notes |
|---|---|---|
| `nuxt.config.ts` | `next.config.ts` + `app/layout.tsx` | CSS, head and modules move into code |
| `app.vue` | `app/layout.tsx` | Root layout owns `<html>`/`<body>` |
| `assets/css/main.css` | `app/globals.css` | Imported in the root layout |
| `plugins/01.antd.ts` | *(none)* + `AntdRegistry` in layout | React antd components are imported per file, no `app.use` |
| `plugins/02.auth.ts` | `components/Providers.tsx` → `AuthBootstrap` | Loads user on first client render |
| `composables/useApi.ts` | `lib/api.ts` | Plain function, not a hook (no React state) |
| `composables/useApiRequest.ts` | `hooks/useApiRequest.ts` | `ref` → `useState`; + `fieldError` helper |
| `composables/useDatatable.ts` | `hooks/useDatatable.ts` | Imperative `fetchData()` → declarative effect |
| `composables/useDownload.ts` | `hooks/useDownload.ts` | Same logic |
| `composables/useRangePresets.ts` | `lib/rangePresets.ts` | Not stateful, so not a hook |
| `stores/auth.ts` (Pinia) | `stores/auth.ts` (Zustand) | + `ready` flag |
| `middleware/auth.global.ts` | `components/auth/AuthGuard.tsx` | Client guard (token in localStorage) |
| `layouts/default.vue` | `app/(dashboard)/layout.tsx` + `components/layout/AppLayout.tsx` | |
| `layouts/blank.vue` | *(none)* | Pages outside the group get only the root layout |
| `components/layout/*.vue` | `components/layout/*.tsx` | |
| `pages/index.vue` | `app/page.tsx` + `components/auth/LoginForm.tsx` | Page = server shell, form = client |
| `pages/invite/[code].vue` | `app/invite/[code]/page.tsx` + `components/auth/InviteRegister.tsx` | Async `params` in `<Suspense>` |
| `pages/admin/dashboard.vue` | `app/(dashboard)/admin/dashboard/page.tsx` | |
| `pages/admin/team-members.vue` | `app/(dashboard)/admin/team-members/page.tsx` + `components/admin/TeamMembers.tsx` | |
| `pages/superadmin/dashboard.vue` | `app/(dashboard)/superadmin/dashboard/page.tsx` | |
| `pages/superadmin/urls/index.vue` | `app/(dashboard)/superadmin/urls/page.tsx` | |
| `pages/superadmin/urls/[client_id].vue` | `app/(dashboard)/superadmin/urls/[client_id]/page.tsx` | |
| `components/admin/*.vue`, `components/superadmin/*.vue` | same names, `.tsx` | Templates → JSX |
| `utils/homeRoute.ts`, `utils/storageKeys.ts` | `lib/…` | Unchanged logic |

---

## 4. Step 1 — Create the Next.js project

```bash
npx create-next-app@latest frontend-next \
  --ts --eslint --app --src-dir --no-tailwind --import-alias "@/*" --use-npm --disable-git --yes
cd frontend-next
npm install antd @ant-design/icons @ant-design/nextjs-registry dayjs zustand
```

| Package | Replaces | Why |
|---|---|---|
| `antd` (v6) | `ant-design-vue` | Same design system, React API |
| `@ant-design/icons` | `@ant-design/icons-vue` | |
| `@ant-design/nextjs-registry` | — | Extracts antd's CSS-in-JS during server rendering so pages aren't unstyled on first paint |
| `zustand` | `pinia`, `@pinia/nuxt` | Small, hook-based global store |
| `dayjs` | `dayjs` | Same (antd uses it for dates) |

Not needed: `typescript`/`vue-tsc` setup (Next ships TS support), a router (built in),
and an HTTP client (`fetch` is enough).

`package.json` scripts, with the port moved so both frontends can run side by side:

```json
"scripts": {
  "dev": "next dev --port 3001",
  "build": "next build",
  "start": "next start --port 3001",
  "lint": "eslint"
}
```

> **Next 16 notes:** Turbopack is the default for `dev` and `build`; `next lint` was
> removed (use the ESLint CLI); Node 20.9+ is required. The scaffold also writes an
> `AGENTS.md` that points coding agents at the version-matched docs in
> `node_modules/next/dist/docs/`.

---

## 5. Step 2 — Configuration and environment variables

### Nuxt

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  ssr: false,
  modules: ['@pinia/nuxt'],
  css: ['ant-design-vue/dist/reset.css', '~/assets/css/main.css'],
  app: { head: { title: 'URL Shortner' } },
  runtimeConfig: { public: { apiBase: 'http://localhost:8000/api' } },
})
```

### Next

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents / partialPrefetching are off: every page loads its data in
  // the browser with a token from localStorage, so there is nothing to cache on
  // the server, and antd's style registry generates ids during render, which
  // Cache Components refuses to prerender.
};

export default nextConfig;
```

```bash
# .env.example  (copy to .env.local)
NEXT_PUBLIC_API_BASE=http://localhost:8000/api
```

```ts
// src/lib/api.ts
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api";
```

### Where each Nuxt option went

| Nuxt option | Next equivalent |
|---|---|
| `ssr: false` | No global switch. Interactive components are `"use client"`; data loads in `useEffect` |
| `modules: ['@pinia/nuxt']` | `npm i zustand`; no registration needed |
| `css: [...]` | `import "./globals.css"` in `app/layout.tsx`. antd v5+ needs no reset CSS import (CSS-in-JS) |
| `app.head.title` | `export const metadata = { title: { template, default } }` in the root layout |
| `runtimeConfig.public.apiBase` | `process.env.NEXT_PUBLIC_API_BASE` |

> **Key difference: build time vs runtime.** Nuxt's `runtimeConfig.public` can be
> overridden by `NUXT_PUBLIC_API_BASE` **when the server starts**. Next **inlines**
> `NEXT_PUBLIC_*` into the client bundle **at build time**. Changing the API URL means
> **rebuilding**, or serving config from the server (e.g. a Server Component reading
> `process.env` after `await connection()`, passed down as a prop). Next 16 also removed
> `publicRuntimeConfig` / `serverRuntimeConfig`.

---

## 6. Step 3 — Server vs Client Components

This has no direct Nuxt equivalent, and it shapes every file in the App Router.

| | Server Component (default) | Client Component (`"use client"`) |
|---|---|---|
| Runs | On the server only (build or request time) | Server pre-render (HTML) **and** in the browser |
| Can use | `async/await`, DB, secrets, `fs`, `cookies()`, `headers()` | `useState`, `useEffect`, event handlers, `window`, `localStorage` |
| Ships JS to browser | No | Yes |
| Hooks | Not allowed | Allowed |

- `"use client"` marks a **boundary**: that file and everything it imports become client
  code.
- A Server Component can render Client Components and pass **serializable** props
  (strings, numbers, plain objects, promises, JSX). Functions can't be passed, except
  Server Actions.
- A Client Component can receive Server Components as `children`, which is how
  `AuthGuard` (client) wraps server pages here.
- **Client Components still pre-render on the server.** `"use client"` is not Nuxt's
  `ssr: false`; it means "this also hydrates in the browser". So code like
  `localStorage.getItem()` must not run during render. Put it in `useEffect` or an event
  handler. That's why the auth store reads the token in `init()`, called from an effect.

How this project splits:

```
app/(dashboard)/admin/dashboard/page.tsx   ← Server Component (exports metadata)
  └─ <AuthGuard>                           ← Client (reads store, redirects)
       └─ <ShortUrls>                      ← Client (state, effects, antd)
```

Pages stay Server Components so they can export `metadata` (only allowed in Server
Components) and keep the client boundary as low as possible.

---

## 7. Step 4 — Root layout and providers

### Nuxt

```vue
<!-- app.vue -->
<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
```

```ts
// plugins/01.antd.ts
export default defineNuxtPlugin((nuxtApp) => { nuxtApp.vueApp.use(Antd) })

// plugins/02.auth.ts
export default defineNuxtPlugin(async () => {
  await useAuthStore().fetchUser()   // before first navigation
})
```

### Next — root layout

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    template: "%s | URL Shortner",
    default: "URL Shortner",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        {/* Collects antd's CSS-in-JS styles during server rendering */}
        <AntdRegistry>
          <Providers>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}
```

- The root layout is **required** and must render `<html>` and `<body>`. Nuxt generates
  the HTML shell for you.
- `LayoutProps<"/">` is a **global type helper** generated by `next typegen` (also during
  `dev`/`build`), similar to Nuxt's generated `.nuxt` types.
- `title.template` makes each page's `metadata.title = "Clients"` render as
  `Clients | URL Shortner`.

### Next — providers (replaces plugins)

```tsx
// src/components/Providers.tsx
"use client";

import { useEffect } from "react";
import { App, ConfigProvider } from "antd";
import { setMessageApi } from "@/lib/notify";
import { useAuthStore } from "@/stores/auth";

// Hands antd's context-aware message API to non-React code
function AntdStaticHolder() {
  const { message } = App.useApp();

  useEffect(() => {
    setMessageApi(message);
  }, [message]);

  return null;
}

// Reads the token and loads the user once, on first client render
function AuthBootstrap() {
  useEffect(() => {
    useAuthStore.getState().init();
  }, []);

  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider>
      <App>
        <AntdStaticHolder />
        <AuthBootstrap />
        {children}
      </App>
    </ConfigProvider>
  );
}
```

| Nuxt plugin behaviour | Next pattern |
|---|---|
| `vueApp.use(Antd)` registers components globally | Not needed: `import { Button } from "antd"` in each file (tree-shaken) |
| Plugin runs **before** the app mounts | Providers render with the app; effects run **after** first paint |
| Async plugin is **awaited** before route middleware | Can't block rendering, so the store has a **`ready`** flag and `AuthGuard` shows a spinner until it's true |
| `provide: { api }` | Context provider, or a plain module import |

**Why `AntdStaticHolder`?** In React antd, `message.error()` / `Modal.confirm()` called
as static functions can't read the `ConfigProvider` context (theme, locale). The
recommended way is `App.useApp()`, which only works inside components. Our API client is a
plain module, so this holder copies the context-aware `message` instance into
`lib/notify.ts` once mounted:

```ts
// src/lib/notify.ts
import type { MessageInstance } from "antd/es/message/interface";

let messageApi: MessageInstance | null = null;

export const setMessageApi = (api: MessageInstance) => {
  messageApi = api;
};

export const notifyError = (text: string) => {
  messageApi?.error(text);
};
```

---

## 8. Step 5 — HTTP layer

### Nuxt

```ts
export const useApi = () => {
  const config = useRuntimeConfig()
  return $fetch.create({
    baseURL: config.public.apiBase,
    method: 'POST',
    headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    onRequest({ options }) {
      const token = localStorage.getItem(AUTH_TOKEN)
      if (token) options.headers.set('Authorization', `Bearer ${token}`)
    },
    onResponseError({ response }) {
      if (response.status === 401) { localStorage.clear(); window.location.href = '/' }
      else if (response.status === 403) { message.error(response._data?.message || 'Forbidden') }
    },
  })
}
```

### Next

```ts
// src/lib/api.ts
import { AUTH_TOKEN } from "./storageKeys";
import { notifyError } from "./notify";

export interface ApiResponse<T = unknown> {
  status: boolean;
  message: string;
  data: T;
}

// Laravel error body: { message, errors: { field: [messages] } }
export interface ApiErrorBody {
  message?: string;
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: ApiErrorBody | null,
  ) {
    super(data?.message ?? `Request failed with status ${status}`);
  }
}

interface ApiOptions {
  body?: Record<string, unknown>;
  responseType?: "json" | "blob";
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api";

// POST to the Laravel API: adds the bearer token and handles 401/403
export async function api<T = ApiResponse>(url: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };

  const token = localStorage.getItem(AUTH_TOKEN);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/${url.replace(/^\//, "")}`, {
    method: "POST",
    headers,
    body: JSON.stringify(options.body ?? {}),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);

    if (response.status === 401) {
      localStorage.clear();
      // Full reload resets the store and lands on login (outside React, so no router)
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/";
    } else if (response.status === 403) {
      notifyError(data?.message || "Forbidden");
    }

    throw new ApiError(response.status, data);
  }

  return (options.responseType === "blob" ? response.blob() : response.json()) as Promise<T>;
}
```

| ofetch feature | Raw `fetch` equivalent |
|---|---|
| `baseURL` | Prefix the URL |
| `body: {}` auto-JSON | `JSON.stringify` + `Content-Type: application/json` |
| Auto-parse JSON | `response.json()` |
| Throws on non-2xx (`FetchError` with `.data`) | `fetch` **does not throw** on 4xx/5xx; check `response.ok` and throw our own `ApiError` |
| `onRequest` / `onResponseError` hooks | Inline code before/after `fetch` |
| `responseType: 'blob'` | `response.blob()` |

**Why a plain function, not a hook?** It has no React state, so it doesn't need to be a
hook. That lets the Zustand store and other non-component code call it. (In Nuxt,
`useApi()` was a composable only because it called `useRuntimeConfig()`.)

**Why no `fetch` caching options?** Next extends `fetch` with caching only in **Server
Components / Route Handlers**. In the browser it's the normal Web `fetch`.

---

## 9. Step 6 — Composables → custom hooks

A Vue composable runs **once** in `setup`. A React hook runs **on every render**, so
anything that must persist lives in `useState`/`useRef`.

### 9.1 `useApiRequest`

**Nuxt**

```ts
export const useApiRequest = () => {
  const api = useApi()
  const rules = ref<Record<string, string[]>>({})
  const loading = ref(false)

  const apiRequest = async (configObject) => {
    loading.value = true
    rules.value = {}
    try {
      const res = await api(configObject.url, { body: configObject.data ?? {} })
      loading.value = false
      configObject.success?.(res)
    } catch (err: any) {
      rules.value = err?.data?.errors ?? {}
      loading.value = false
      configObject.error?.({ status: err?.status, data: err?.data })
    }
  }
  return { rules, loading, apiRequest }
}
```

**Next**

```ts
// src/hooks/useApiRequest.ts
"use client";

import { useState } from "react";
import { api, ApiError, type ApiErrorBody, type ApiResponse } from "@/lib/api";

interface ApiRequestConfig<T> {
  url: string;
  data?: Record<string, unknown>;
  success?: (res: ApiResponse<T>) => void;
  error?: (err: { status?: number; data?: ApiErrorBody | null }) => void;
}

// Form submit helper: tracks loading and exposes Laravel validation errors as `rules`
export function useApiRequest() {
  const [rules, setRules] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  const apiRequest = async <T = unknown>(config: ApiRequestConfig<T>) => {
    setLoading(true);
    setRules({});

    try {
      const res = await api<ApiResponse<T>>(config.url, { body: config.data ?? {} });
      setLoading(false);

      config.success?.(res);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : undefined;
      const data = err instanceof ApiError ? err.data : undefined;

      setRules(data?.errors ?? {});
      setLoading(false);

      config.error?.({ status, data });
    }
  };

  return { rules, loading, apiRequest };
}

// Props for an antd <Form.Item> showing the first server error for `field`
export const fieldError = (rules: Record<string, string[]>, field: string) =>
  rules[field]
    ? { help: rules[field][0], validateStatus: "error" as const }
    : {};
```

| Vue | React |
|---|---|
| `rules.value = {}` | `setRules({})` |
| Returns refs (reactive, readable via `.value`) | Returns current **values** plus functions; the component re-renders when they change |
| Template: `:help="rules.email ? rules.email[0] : undefined" :validateStatus="..."` (repeated per field) | `<Form.Item {...fieldError(rules, "email")}>`: spread props |
| `apiRequest` typed by `ApiResponse` (`any` data) | Generic: `apiRequest<{ user: AuthUser; token: string }>(…)` gives a typed `res.data` |

### 9.2 `useDatatable`: imperative → declarative

The Nuxt version was **imperative**: set `url.value`, mutate `params.value`, then call
`fetchData()`. The idiomatic React version is **declarative**: the hook takes `url` and
`params` as arguments and an effect refetches whenever they (or the page) change.

```ts
// src/hooks/useDatatable.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import type { TablePaginationConfig } from "antd";
import { api, type ApiResponse } from "@/lib/api";

interface Paginated<T> {
  data: T[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

// Paginated list backed by a Laravel endpoint. Refetches whenever `url`,
// `params`, page or page size change.
export function useDatatable<T>(url: string, params: Record<string, unknown> = {}) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  // Bumped to force a refetch with unchanged inputs (e.g. after creating a row)
  const [version, setVersion] = useState(0);

  // Stable dependency for the params object
  const paramsKey = JSON.stringify(params);

  // Filter changes start again from the first page
  const [prevKey, setPrevKey] = useState(url + paramsKey);
  if (prevKey !== url + paramsKey) {
    setPrevKey(url + paramsKey);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await api<ApiResponse<Paginated<T>>>(url, {
          body: { per_page: pageSize, page, ...JSON.parse(paramsKey) },
        });
        if (!cancelled) {
          setData(res.data.data);
          setTotal(res.data.meta.total);
        }
      } catch {
        // Errors are surfaced by the api client
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [url, paramsKey, page, pageSize, version]);

  const handleTableChange = (pagination: TablePaginationConfig) => {
    setPage(pagination.current ?? 1);
    setPageSize(pagination.pageSize ?? 10);
  };

  const reload = useCallback(() => {
    setPage(1);
    setVersion((v) => v + 1);
  }, []);

  const tablePagination: TablePaginationConfig = {
    current: page,
    pageSize,
    total,
    showSizeChanger: true,
  };

  return { data, loading, tablePagination, handleTableChange, reload };
}
```

Concepts packed into this hook:

1. **Dependency arrays.** `useEffect(fn, deps)` re-runs when any dependency changes
   (compared with `Object.is`). It's the React counterpart of `watch([a, b], fn)`.
2. **Object identity.** `params` is a new object on every render (`{ ...dateRange }`), so
   using it as a dependency would refetch forever. Serializing it to `paramsKey` gives a
   **stable primitive**. In Vue, `watch` with `deep: true` handles this for you.
3. **Race conditions / cleanup.** The returned function runs before the next effect (and
   on unmount). The `cancelled` flag ignores responses that arrive after the inputs
   changed. Vue's `watch` offers `onCleanup` for the same purpose.
4. **Adjusting state when inputs change.** Resetting `page` to 1 when filters change is
   done **during render** (the `prevKey` pattern from the React docs) rather than in an
   extra effect, which would render twice.
5. **`useCallback`** keeps `reload` the same function between renders, so children
   receiving it as a prop don't see a new value every time.
6. **Forcing a refetch.** `version` is a counter in the dependency list. Bumping it
   refetches with the same inputs (used after generating a URL).

> In a larger app, use **TanStack Query** or **SWR** instead of a hand-written effect:
> caching, deduplication, retries and race handling come built in. It's the closest thing
> to Nuxt's `useFetch` on the client.

### 9.3 `useDownload` and presets

`useDownload` is a line-for-line port (`ref` → `useState`, `useApi()` → `api`).
`useRangePresets` became a plain function in `lib/rangePresets.ts`: it holds no state, so
calling it a hook would only add the hook rules for nothing.

```ts
// src/lib/rangePresets.ts
import dayjs, { type Dayjs } from "dayjs";

export const rangePresets = (): { label: string; value: [Dayjs, Dayjs] }[] => [
  { label: "Last 7 Days", value: [dayjs().add(-7, "d"), dayjs()] },
  { label: "Last 14 Days", value: [dayjs().add(-14, "d"), dayjs()] },
  { label: "Last 30 Days", value: [dayjs().add(-30, "d"), dayjs()] },
  { label: "Last 90 Days", value: [dayjs().add(-90, "d"), dayjs()] },
];
```

---

## 10. Step 7 — Pinia → Zustand

### Nuxt (Pinia setup store)

```ts
export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const authToken = ref<string | null>(localStorage.getItem(AUTH_TOKEN) || null)
  const isLoggedIn = computed(() => !!authToken.value)
  // updateUser, updateAuthToken, fetchUser, logoutAction (calls navigateTo('/'))
  return { user, isLoggedIn, authToken, /* ... */ }
})
```

### Next (Zustand)

```ts
// src/stores/auth.ts
import { create } from "zustand";
import { api, type ApiResponse } from "@/lib/api";
import { AUTH_TOKEN } from "@/lib/storageKeys";
import type { AuthUser } from "@/lib/homeRoute";

interface AuthState {
  user: AuthUser | null;
  authToken: string | null;
  // True once the token has been read from localStorage and the user loaded
  ready: boolean;

  updateUser: (user: AuthUser | null) => void;
  updateAuthToken: (token: string | null) => void;
  init: () => Promise<void>;
  logoutAction: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  authToken: null,
  ready: false,

  updateUser: (user) => set({ user }),

  updateAuthToken: (token) => {
    if (token) {
      localStorage.setItem(AUTH_TOKEN, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN);
    }
    set({ authToken: token });
  },

  init: async () => {
    const token = localStorage.getItem(AUTH_TOKEN);
    set({ authToken: token });

    if (token) {
      try {
        const response = await api<ApiResponse<{ user: AuthUser }>>("user");
        set({ user: response.data.user });
      } catch {
        // Stale or invalid token
        get().updateAuthToken(null);
        set({ user: null });
      }
    }

    set({ ready: true });
  },

  logoutAction: async () => {
    if (!get().authToken) return;

    try {
      await api("logout");
    } catch {
      // Log out locally even if the token is already invalid
    }

    localStorage.clear();
    set({ authToken: null, user: null });
  },
}));

export const selectIsLoggedIn = (state: AuthState) => !!state.authToken;
```

| Pinia | Zustand |
|---|---|
| `defineStore('auth', () => {...})` | `create<State>((set, get) => ({...}))` |
| `ref` state, mutated: `user.value = x` | Plain values, replaced with `set({ user: x })` (shallow merge) |
| `computed` getter | Selector `(s) => !!s.authToken`, or derive in the component |
| Read another field: `authToken.value` | `get().authToken` |
| `const store = useAuthStore(); store.user` | `const user = useAuthStore((s) => s.user)`: **select only what you use**, so the component re-renders only when that slice changes |
| Outside components: `useAuthStore()` after Pinia is installed | `useAuthStore.getState()` / `.setState()` anywhere, no provider needed |
| `@pinia/nuxt` handles SSR state transfer | Module-level store: fine here because it's only filled in the browser. For SSR data, create the store per request via Context |
| `navigateTo('/')` inside the action | The action stays router-agnostic; the component calls `router.replace('/')` |

**Why the `ready` flag?** Nuxt awaited the async plugin before the first route guard ran,
so the guard always knew the user. React can't block rendering on an effect, so the store
records when initialization is done and the guard waits for it.

**Why the token isn't read at store creation:** the Nuxt store did
`ref(localStorage.getItem(...))` safely because `ssr: false`. In Next the module is also
evaluated during server pre-rendering, where `localStorage` doesn't exist. Reading it in
`init()` (called from `useEffect`) runs only in the browser.

---

## 11. Step 8 — Routing: `pages/` → `app/`

| Nuxt file | URL | Next file |
|---|---|---|
| `pages/index.vue` | `/` | `app/page.tsx` |
| `pages/invite/[code].vue` | `/invite/:code` | `app/invite/[code]/page.tsx` |
| `pages/admin/dashboard.vue` | `/admin/dashboard` | `app/(dashboard)/admin/dashboard/page.tsx` |
| `pages/admin/team-members.vue` | `/admin/team-members` | `app/(dashboard)/admin/team-members/page.tsx` |
| `pages/superadmin/dashboard.vue` | `/superadmin/dashboard` | `app/(dashboard)/superadmin/dashboard/page.tsx` |
| `pages/superadmin/urls/index.vue` | `/superadmin/urls` | `app/(dashboard)/superadmin/urls/page.tsx` |
| `pages/superadmin/urls/[client_id].vue` | `/superadmin/urls/:client_id` | `app/(dashboard)/superadmin/urls/[client_id]/page.tsx` |

Rules:
- **Folders** define URL segments. A route exists only if the folder has a `page.tsx`.
  Other files in the folder (components, utils) are **not** routes, so you can colocate.
- `[param]` dynamic, `[...slug]` catch-all, `[[...slug]]` optional catch-all.
- `(group)` folders organize routes and share layouts **without** affecting the URL.
- `_folder` is private (never a route).
- Special files per segment: `layout`, `page`, `loading`, `error`, `not-found`,
  `template`, `route`, `default`.

### A simple page

```tsx
// src/app/(dashboard)/admin/dashboard/page.tsx
import type { Metadata } from "next";
import AuthGuard from "@/components/auth/AuthGuard";
import ShortUrls from "@/components/admin/ShortUrls";

export const metadata: Metadata = { title: "Short URLs" };

export default function AdminDashboardPage() {
  return (
    <AuthGuard allowedUserType={["admin", "member"]}>
      <ShortUrls />
    </AuthGuard>
  );
}
```

`definePageMeta({ requireAuth, allowedUserType })` becomes **props on a wrapper
component**, and `useHead` becomes the `metadata` export.

### A dynamic page (async `params` + Suspense)

```tsx
// src/app/(dashboard)/superadmin/urls/[client_id]/page.tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "antd";
import AuthGuard from "@/components/auth/AuthGuard";
import ShortUrls from "@/components/superadmin/ShortUrls";

export const metadata: Metadata = { title: "Client Short URLs" };

type Props = PageProps<"/superadmin/urls/[client_id]">;

// `params` is only known at request time, so it is awaited inside <Suspense>
async function ClientShortUrls({ params }: { params: Props["params"] }) {
  const { client_id } = await params;
  return <ShortUrls clientId={client_id} />;
}

export default function SuperadminClientUrlsPage(props: Props) {
  return (
    <AuthGuard allowedUserType={["superadmin"]}>
      <Suspense fallback={<Skeleton active />}>
        <ClientShortUrls params={props.params} />
      </Suspense>
    </AuthGuard>
  );
}
```

- **Next 16: `params` and `searchParams` are Promises.** Synchronous access (allowed with
  a warning in Next 15) is removed. Await them in an `async` Server Component, or call
  `use(params)` in a Client Component.
- `PageProps<'/superadmin/urls/[client_id]'>` is a generated, route-aware type: a typo
  in the route string or param name is a type error. Note that the route string **omits**
  the `(dashboard)` group.
- Awaiting inside a child wrapped in `<Suspense>` lets the rest of the page (and the
  layout) render immediately and **stream** the dynamic part. With Cache Components
  enabled, request-time data **must** sit under a Suspense boundary or the build fails.
- Client alternative: `const { client_id } = useParams<{ client_id: string }>()`.
- Navigating `/superadmin/urls/2` → `/superadmin/urls/5` re-renders `ShortUrls` with a new
  `clientId` prop; `useDatatable` sees new `params` and refetches. In Nuxt we needed an
  explicit `watch(() => props.clientId, loadData)`.

### Navigation

| Nuxt | Next |
|---|---|
| `<NuxtLink to="/x">` | `<Link href="/x">` |
| `navigateTo('/x')` (client) | `const router = useRouter(); router.push('/x')` (`next/navigation`, **not** `next/router`) |
| `navigateTo('/x', { replace: true })` | `router.replace('/x')` |
| `navigateTo('/x')` in server/middleware | `redirect('/x')` from `next/navigation` (Server Components, Actions), `NextResponse.redirect` in `proxy.ts` |
| `useRoute().path` | `usePathname()` |
| `useRoute().query` | `useSearchParams()` (client, needs Suspense when prerendering) |
| `router.back()` | `router.back()` |
| `refreshNuxtData()` | `router.refresh()` (re-runs Server Components for the current route) |

---

## 12. Step 9 — Layouts

### Nuxt

- `layouts/default.vue` wraps every page unless the page says
  `definePageMeta({ layout: 'blank' })`.
- The layout is picked **per page** at runtime.

### Next

Layouts are **files in the route tree**. A `layout.tsx` wraps every page **below it**.
To give a set of routes a layout without changing their URLs, use a **route group**:

```
app/
├── layout.tsx            ← root: <html>, providers (everyone)
├── page.tsx              ← "/" login: root layout only ("blank" layout)
├── invite/[code]/page.tsx← root layout only ("blank" layout)
└── (dashboard)/
    ├── layout.tsx        ← header + auth guard ("default" layout)
    ├── admin/...
    └── superadmin/...
```

```tsx
// src/app/(dashboard)/layout.tsx
import AuthGuard from "@/components/auth/AuthGuard";
import AppLayout from "@/components/layout/AppLayout";

// Route group: wraps every page under (dashboard) without adding a URL segment
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requireAuth>
      <AppLayout>{children}</AppLayout>
    </AuthGuard>
  );
}
```

```tsx
// src/components/layout/AppLayout.tsx
"use client";

import { Col, Layout, Row } from "antd";
import { useAuthStore } from "@/stores/auth";
import AdminMenus from "./AdminMenus";
import SuperadminMenus from "./SuperadminMenus";
import Logout from "./Logout";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);

  return (
    <Layout>
      <Layout.Header style={{ background: "#fff", padding: "0 50px" }}>
        <Row>
          <Col span={12}>
            <Row>
              <Col span={6}>
                <span style={{ fontWeight: "bolder" }}>{user?.company?.name}</span>
              </Col>
              <Col span={18}>
                {user?.type === "superadmin" && <SuperadminMenus />}
                {(user?.type === "admin" || user?.type === "member") && <AdminMenus />}
              </Col>
            </Row>
          </Col>
          <Col span={12} style={{ textAlign: "right" }}>
            <Logout />
          </Col>
        </Row>
      </Layout.Header>
      <Layout.Content style={{ padding: "0 50px", minHeight: "100vh" }}>{children}</Layout.Content>
    </Layout>
  );
}
```

| Nuxt layouts | Next layouts |
|---|---|
| Chosen by the page (`definePageMeta`) | Determined by **where the page lives** in the tree |
| One layout at a time (plus `app.vue`) | **Nested**: root → group → segment layouts all wrap the page |
| `<slot />` | `{children}` |
| Re-renders on navigation | **Preserved** across navigations between sibling pages (state kept, not re-mounted). Use `template.tsx` to remount each time |
| `layouts/blank.vue` | Just don't put the page under the group |

Because the dashboard layout is preserved, the header doesn't flicker or refetch when you
move between `/admin/dashboard` and `/admin/team-members`.

---

## 13. Step 10 — Route middleware → `AuthGuard`

### Nuxt

```ts
// middleware/auth.global.ts
export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()
  if (to.meta.requireAuth && !authStore.isLoggedIn) return navigateTo('/')
  if (to.path === '/' && authStore.isLoggedIn) return navigateTo(homeRouteFor(authStore.user))
  const allowedTypes = to.meta.allowedUserType
  if (allowedTypes && authStore.user && !allowedTypes.includes(authStore.user.type)) {
    return navigateTo(homeRouteFor(authStore.user))
  }
})
```

Nuxt route middleware runs **in the browser** (in an SPA), so it can read the store,
which was filled from `localStorage`.

### Why not Next's `proxy.ts`?

Next's `proxy.ts` (renamed from `middleware.ts` in v16) runs **on the server** before
a request is handled. It can read **cookies and headers** but **not `localStorage`**.
Our Laravel API returns a bearer token stored in `localStorage` (kept to match the
original app), so the server can't know who is logged in. The guard has to run on the
client:

```tsx
// src/components/auth/AuthGuard.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Flex, Spin } from "antd";
import { useAuthStore } from "@/stores/auth";
import { homeRouteFor, type UserType } from "@/lib/homeRoute";

interface AuthGuardProps {
  requireAuth?: boolean;
  requireUnauth?: boolean;
  allowedUserType?: UserType[];
  children: React.ReactNode;
}

// Client-side route guard: the token lives in localStorage, which only the
// browser can read, so this can't be done in proxy.ts
export default function AuthGuard({ requireAuth, requireUnauth, allowedUserType, children }: AuthGuardProps) {
  const router = useRouter();
  const ready = useAuthStore((s) => s.ready);
  const user = useAuthStore((s) => s.user);
  const isLoggedIn = useAuthStore((s) => !!s.authToken);

  let redirectTo: string | null = null;
  if (ready) {
    if (requireAuth && !isLoggedIn) {
      redirectTo = "/";
    } else if (requireUnauth && isLoggedIn) {
      redirectTo = homeRouteFor(user);
    } else if (allowedUserType && user && !allowedUserType.includes(user.type)) {
      redirectTo = homeRouteFor(user);
    }
  }

  useEffect(() => {
    if (redirectTo) {
      router.replace(redirectTo);
    }
  }, [redirectTo, router]);

  if (!ready || redirectTo) {
    return (
      <Flex justify="center" align="center" style={{ minHeight: "60vh" }}>
        <Spin />
      </Flex>
    );
  }

  return <>{children}</>;
}
```

- The redirect target is **derived during render**; the side effect (`router.replace`)
  happens in an effect. Calling `router.replace` directly during render is a side effect
  in render, which React forbids.
- Protected content is not rendered until `ready` and allowed, so there's no flash of a
  page the user can't see.
- `requireAuth` lives on the **group layout**; `allowedUserType` lives on each **page**.
  This mirrors the Nuxt meta.

### The server-side alternative (production recommendation)

Store the token in an **httpOnly cookie** (Laravel Sanctum SPA auth, or set it from a
Next Route Handler after login). Then guard in `proxy.ts`:

```ts
// src/proxy.ts  (sketch, not used in this project)
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  const isLogin = request.nextUrl.pathname === "/";

  if (!token && !isLogin) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|invite).*)"],
};
```

Benefits: unauthenticated users are redirected **before** any HTML or JS is sent; Server
Components can fetch data with the cookie; and the token can't be read by XSS. Role
checks still need the user, either from a JWT claim or a backend call (keep `proxy`
fast, and always re-check on the API).

| | Nuxt route middleware | Next `proxy.ts` | Next client guard |
|---|---|---|---|
| Runs | Client (SPA) / server+client (SSR) | Server (Node runtime), every matching request | Browser |
| Reads | Store, cookies (`useCookie`) | Cookies, headers, URL | Store, localStorage |
| Redirect | `return navigateTo()` | `NextResponse.redirect()` | `router.replace()` in effect |
| Per page | `definePageMeta({ middleware })` | `matcher` config / path checks | Wrapper props |

---

## 14. Step 11 — Templates → JSX

### 14.1 Login

**Nuxt** (`pages/index.vue`, abridged)

```vue
<a-form-item label="Email" name="email"
    :help="rules.email ? rules.email[0] : undefined"
    :validateStatus="rules.email ? 'error' : undefined" class="required">
    <a-input v-model:value="formData.email" placeholder="Please Enter Your Email" @pressEnter="onSubmit" />
</a-form-item>
...
<script setup lang="ts">
definePageMeta({ layout: "blank", requireUnauth: true });
const authStore = useAuthStore();
const { loading, rules, apiRequest } = useApiRequest();
const formData = ref({ email: "", password: "" });
const onSubmit = () => {
    apiRequest({ url: "login", data: formData.value, success: (res) => {
        authStore.updateAuthToken(res.data.token);
        authStore.updateUser(res.data.user);
        navigateTo(homeRouteFor(res.data.user));
    }});
};
</script>
```

**Next**: split into a server page (meta) and a client form (interactivity):

```tsx
// src/app/page.tsx
import type { Metadata } from "next";
import AuthGuard from "@/components/auth/AuthGuard";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Login" };

export default function LoginPage() {
  return (
    <AuthGuard requireUnauth>
      <LoginForm />
    </AuthGuard>
  );
}
```

```tsx
// src/components/auth/LoginForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Col, Form, Input, Row } from "antd";
import { fieldError, useApiRequest } from "@/hooks/useApiRequest";
import { homeRouteFor, type AuthUser } from "@/lib/homeRoute";
import { useAuthStore } from "@/stores/auth";

export default function LoginForm() {
  const router = useRouter();
  const { updateAuthToken, updateUser } = useAuthStore();
  const { loading, rules, apiRequest } = useApiRequest();
  const [formData, setFormData] = useState({ email: "", password: "" });

  const onSubmit = () => {
    apiRequest<{ user: AuthUser; token: string }>({
      url: "login",
      data: formData,
      success: (res) => {
        const user = res.data.user;
        updateAuthToken(res.data.token);
        updateUser(user);

        router.replace(homeRouteFor(user));
      },
    });
  };

  return (
    <div className="center-screen">
      <Row justify="center" align="middle" style={{ width: "50%" }}>
        <Col xs={22} sm={20} md={16} lg={12} xl={10} style={{ minWidth: 360 }}>
          <Card>
            <h2 style={{ textAlign: "center", marginBottom: 24 }}>Login</h2>
            <Form layout="vertical">
              <Form.Item label="Email" required {...fieldError(rules, "email")}>
                <Input
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Please Enter Your Email"
                  onPressEnter={onSubmit}
                />
              </Form.Item>

              <Form.Item label="Password" required {...fieldError(rules, "password")}>
                <Input.Password
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Please Enter Your Password"
                  onPressEnter={onSubmit}
                />
              </Form.Item>

              <Form.Item>
                <Button onClick={onSubmit} loading={loading} type="primary" block>
                  Submit
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
```

Translation notes:
- `v-model:value` → `value` + `onChange={(e) => setFormData({ ...formData, email: e.target.value })}`.
- `class="required"` + custom CSS asterisk → antd's built-in `required` prop on `Form.Item`.
- `<a-input-password>` → `<Input.Password>`: antd React uses **namespaced subcomponents**.
- `router.replace` (not `push`): after logging in, Back shouldn't return to the login form.
- `const { updateAuthToken, updateUser } = useAuthStore()` selects the whole store. That's
  fine here because actions never change; for state, prefer narrow selectors.

### 14.2 Invite registration

Server page awaits `params` in Suspense (same pattern as §11) and passes `inviteCode` as
a prop:

```tsx
// src/app/invite/[code]/page.tsx
import { Suspense } from "react";
import type { Metadata } from "next";
import { Skeleton } from "antd";
import InviteRegister from "@/components/auth/InviteRegister";

export const metadata: Metadata = { title: "Complete Registration" };

// `params` is only known at request time, so it is awaited inside <Suspense>
async function Invite({ params }: { params: PageProps<"/invite/[code]">["params"] }) {
  const { code } = await params;
  return <InviteRegister inviteCode={code} />;
}

export default function InvitePage(props: PageProps<"/invite/[code]">) {
  return (
    <Suspense fallback={<Skeleton active />}>
      <Invite params={props.params} />
    </Suspense>
  );
}
```

The client component's key parts:

```tsx
// src/components/auth/InviteRegister.tsx (excerpt)
"use client";

export default function InviteRegister({ inviteCode }: { inviteCode: string }) {
  const router = useRouter();
  const { loading, rules, apiRequest } = useApiRequest();
  const [pageLoading, setPageLoading] = useState(true);
  const [company, setCompany] = useState<Invitation["company"] | null>(null);
  const [invitationMessageType, setInvitationMessageType] = useState<"warning" | "success">("warning");
  const [invitationMessage, setInvitationMessage] = useState("");
  const [formData, setFormData] = useState({
    email: "", name: "", company_name: "", password: "", password_confirmation: "",
  });

  // onMounted(...) → useEffect(..., [inviteCode])
  useEffect(() => {
    api<ApiResponse<{ data: Invitation }>>(`invitation/${inviteCode}`)
      .then((res) => {
        const response = res.data.data;
        setCompany(response.company);
        setFormData((prev) => ({ ...prev, name: response.name, email: response.email }));
      })
      .catch((err) => {
        setInvitationMessage(
          (err instanceof ApiError && err.data?.message) || "Invitation code not exists.",
        );
      })
      .finally(() => setPageLoading(false));
  }, [inviteCode]);

  // One change handler factory instead of repeating v-model per field
  const set = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData({ ...formData, [field]: e.target.value });

  return (
    <div className="center-screen">
      ...
          {pageLoading ? (
            <Skeleton active />
          ) : invitationMessage !== "" ? (
            <Card>
              <Result status={invitationMessageType} title={invitationMessage}
                extra={<Button type="primary" onClick={() => router.push("/")} block>Login</Button>} />
            </Card>
          ) : (
            <Card>
              ...
              {company?.is_global ? (
                <Form.Item label="Company Name" required {...fieldError(rules, "company_name")}>
                  <Input value={formData.company_name} onChange={set("company_name")} ... />
                </Form.Item>
              ) : null}
              ...
            </Card>
          )}
      ...
    </div>
  );
}
```

Notes:
- `v-if / v-else-if / v-else` → a **nested ternary** (or early `return`s).
- `{company?.is_global ? … : null}`, **not** `{company?.is_global && …}`: `is_global` is a
  number, and `0 && x` renders the text **`0`**. This is a classic React gotcha.
- `setFormData((prev) => …)`: the **functional updater** form, needed inside async
  callbacks so you don't overwrite state with a stale snapshot captured by the closure.
- `You&apos;ve`: ESLint's `react/no-unescaped-entities` flags raw `'` in JSX text.

### 14.3 Tables: scoped slots → `render`

**Nuxt**

```vue
<a-table :columns="columns" :data-source="data" :pagination="tablePagination"
         :loading="loading" row-key="id" @change="handleTableChange" size="middle">
    <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'name'">
            <NuxtLink :to="`/superadmin/urls/${record.id}`">{{ record.name }}</NuxtLink>
            <br />{{ record.email }}
        </template>
    </template>
</a-table>
```

**Next**

```tsx
// src/components/superadmin/Clients.tsx
"use client";

import Link from "next/link";
import { Table, type TableColumnsType } from "antd";
import PageHeader from "@/components/PageHeader";
import { useDatatable } from "@/hooks/useDatatable";
import ClientInvite from "./ClientInvite";

interface Client {
  id: number;
  name: string;
  email: string;
  total_users: number;
  total_urls: number;
  total_url_hits: number;
}

const columns: TableColumnsType<Client> = [
  {
    title: "Client name",
    dataIndex: "name",
    render: (_, record) => (
      <>
        <Link href={`/superadmin/urls/${record.id}`}>{record.name}</Link>
        <br />
        {record.email}
      </>
    ),
  },
  { title: "Users", dataIndex: "total_users" },
  { title: "Total Generated URLs", dataIndex: "total_urls" },
  { title: "Total URL Hits", dataIndex: "total_url_hits" },
];

export default function Clients() {
  const { data, loading, tablePagination, handleTableChange } = useDatatable<Client>("superadmin/clients");

  return (
    <div>
      <PageHeader title="Clients" extra={<ClientInvite />} />

      <Table
        columns={columns}
        dataSource={data}
        pagination={tablePagination}
        loading={loading}
        rowKey="id"
        onChange={handleTableChange}
        size="middle"
      />
    </div>
  );
}
```

- The `bodyCell` slot with `v-if` per column becomes a **`render` function on each
  column**. Rendering logic sits next to the column definition, so no dispatching on
  `dataIndex`.
- `TableColumnsType<Client>` types `record` in `render`.
- `columns` is defined **outside** the component so it isn't recreated on every render.
- `<>…</>` is a **Fragment**: multiple children without a wrapper element.
- `onMounted(() => { url.value = '...'; fetchData() })` disappeared: the hook takes the
  URL and fetches on its own.

### 14.4 Filters, download and the client prop

```tsx
// src/components/superadmin/ShortUrls.tsx (component body)
export default function ShortUrls({ clientId }: { clientId?: string }) {
  const [dateRange, setDateRange] = useState<{ start_date?: string; end_date?: string }>({});
  const params = { ...dateRange, ...(clientId ? { company_id: clientId } : {}) };

  const { downloading, download } = useDownload();
  const { data, loading, tablePagination, handleTableChange } = useDatatable<ShortUrl>("superadmin/urls", params);

  return (
    <div>
      <PageHeader
        title="Short URLs"
        extra={
          <>
            <DatePicker.RangePicker
              presets={rangePresets()}
              onChange={(dates, dateStrings) =>
                setDateRange(dates ? { start_date: dateStrings[0], end_date: dateStrings[1] } : {})
              }
            />
            <Button
              type="primary"
              loading={downloading}
              onClick={() => download("superadmin/urls/download", params, "urls.csv")}
            >
              Download
            </Button>
          </>
        }
      />
      <Table columns={columns} dataSource={data} pagination={tablePagination}
             loading={loading} rowKey="id" onChange={handleTableChange} size="middle" />
    </div>
  );
}
```

Compare with Nuxt, where `loadData()` mutated `params.value.company_id`, `onRangeChange`
mutated `params.value.start_date`, and a `watch` on the prop called `loadData()`. In React,
`params` is **derived during render** from state and props; the hook reacts to the change.
That's three moving parts collapsed into one expression, which is the core React idea:
**UI = f(state, props)**.

### 14.5 Modals: `emit` → callback prop

```tsx
// src/components/admin/GenerateUrl.tsx
"use client";

import { useState } from "react";
import { App, Button, Form, Input, Modal } from "antd";
import { fieldError, useApiRequest } from "@/hooks/useApiRequest";

export default function GenerateUrl({ onSuccess }: { onSuccess?: () => void }) {
  const { message } = App.useApp();
  const { loading, rules, apiRequest } = useApiRequest();
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState(false);

  const onSubmit = () => {
    apiRequest({
      url: "admin/urls/generate",
      data: { url },
      success: (res) => {
        setOpen(false);
        setUrl("");

        onSuccess?.();          // was: emit("success")

        message.success(res.message);
      },
    });
  };

  return (
    <>
      <Button type="primary" onClick={() => setOpen(true)}>
        Generate
      </Button>
      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        title="Generate Short URL"
        footer={null}
        styles={{ body: { marginTop: 40 } }}
      >
        <Form layout="vertical">
          <Form.Item label="Long URL" required {...fieldError(rules, "url")}>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter long URL to generate short url"
              onPressEnter={onSubmit}
            />
          </Form.Item>

          <Form.Item>
            <Button onClick={onSubmit} loading={loading} type="primary" block>
              Generate
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
```

Parent: `<GenerateUrl onSuccess={reload} />` (was `<AdminGenerateUrl @success="reload" />`).

- `v-model:open="open"` → `open={open}` + `onCancel={() => setOpen(false)}`. Without
  `onCancel` the close button wouldn't work, because React state only changes when you
  call the setter.
- `ClientInvite` and `TeamMemberInvite` follow the same pattern; `<a-select>` with
  `<a-select-option>` children becomes `<Select options={[...]} />`.

### 14.6 Logout confirm

```tsx
// src/components/layout/Logout.tsx
"use client";

import { useRouter } from "next/navigation";
import { App, Button } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import { useAuthStore } from "@/stores/auth";

export default function Logout() {
  const router = useRouter();
  const { modal } = App.useApp();
  const logoutAction = useAuthStore((s) => s.logoutAction);

  const logout = () => {
    modal.confirm({
      title: "Logout?",
      icon: <ExclamationCircleOutlined />,
      content: "Are you sure you want to logout?",
      async onOk() {
        await logoutAction();
        router.replace("/");
      },
    });
  };

  return (
    <Button type="link" onClick={logout}>
      Logout
    </Button>
  );
}
```

`h(ExclamationCircleOutlined)` → `<ExclamationCircleOutlined />`; `Modal.confirm` →
`modal.confirm` from `App.useApp()` (context-aware).

### 14.7 Menus

```tsx
// src/components/layout/AdminMenus.tsx
"use client";

import Link from "next/link";
import { useAuthStore } from "@/stores/auth";

export default function AdminMenus() {
  const user = useAuthStore((s) => s.user);

  return (
    <>
      <Link href="/admin/dashboard" className="menu-link">
        Dashboard
      </Link>
      {user?.type === "admin" && (
        <Link href="/admin/team-members" className="menu-link">
          Team Members
        </Link>
      )}
    </>
  );
}
```

`SuperadminMenus.tsx` uses no hooks or state, so it has **no `"use client"`**. It can be a
Server Component, even when rendered inside a client parent's tree via import (it becomes
client code there, which is fine).

> Don't wrap `<Button>` in `<Link>`: that produces `<a><button>`, which is invalid HTML
> (interactive content inside interactive content). Use a styled `<Link>`, or
> `<Button onClick={() => router.push(...)}>` if it must look like a button.

---

## 15. Step 12 — Ant Design Vue → Ant Design (React)

| Ant Design Vue 4 | Ant Design 6 (React) |
|---|---|
| `<a-button>` (kebab, auto-resolved) | `import { Button } from "antd"`; `<Button>` |
| `<a-input-password>` | `<Input.Password>` |
| `<a-form-item>` | `<Form.Item>` |
| `<a-layout-header>` | `<Layout.Header>` |
| `<a-range-picker>` | `<DatePicker.RangePicker>` |
| `<a-select-option>` children | `options={[{ value, label }]}` |
| `v-model:value` | `value` + `onChange` |
| `v-model:open` | `open` + `onCancel` |
| `@change` | `onChange` |
| `#bodyCell` slot | `columns[].render` |
| `#extra`, `#subTitle` slots | props taking JSX |
| `:bodyStyle` on Modal | `styles={{ body: {...} }}` (`bodyStyle` deprecated) |
| `<a-page-header>` | **Removed** from antd v5+ (moved to `@ant-design/pro-components`). We wrote a tiny `PageHeader` with `Flex` + `Typography.Title` |
| `Modal.confirm` / `message.success` (static) | `App.useApp()` → `modal`, `message` (respect theme/context) |
| `import 'ant-design-vue/dist/reset.css'` | Not needed (CSS-in-JS). `AntdRegistry` handles SSR style extraction |
| custom `.required` CSS asterisk | `<Form.Item required>` |

```tsx
// src/components/PageHeader.tsx
import { Flex, Space, Typography } from "antd";

interface PageHeaderProps {
  title: string;
  subTitle?: React.ReactNode;
  extra?: React.ReactNode;
}

// antd v5+ dropped PageHeader; this is the small subset the app uses
export default function PageHeader({ title, subTitle, extra }: PageHeaderProps) {
  return (
    <Flex justify="space-between" align="center" style={{ padding: "25px 0" }} wrap gap={12}>
      <Space size="middle">
        <Typography.Title level={4} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {subTitle}
      </Space>
      {extra && <Space>{extra}</Space>}
    </Flex>
  );
}
```

`React.ReactNode` is the type for "anything renderable", the equivalent of a slot's content.

---

## 16. Pitfalls hit during this migration

| Symptom | Cause | Fix |
|---|---|---|
| `next build` fails: *"encountered the unstable value `Math.random()` in a Client Component"* on `/_not-found` and every page | The scaffold enables **Cache Components** (`cacheComponents: true`), which forbids non-deterministic values during prerender outside `<Suspense>`. `AntdRegistry` generates a random cache id while rendering | Disable `cacheComponents` (and `partialPrefetching`, which requires it). Nothing is server-cached in this client-data app. Alternative: wrap the providers in `<Suspense>`, which gives up the static shell |
| Build error: URL data in a Client Component outside Suspense | With Cache Components, `useParams`/`params` on dynamic routes suspend | Await `params` in a child under `<Suspense>` (kept even after disabling, since it's the streaming-friendly pattern) |
| `localStorage is not defined` | Client Components also **pre-render on the server** | Read it in `useEffect` / event handlers (`init()` in `AuthBootstrap`) |
| Guard redirects a logged-in user to login on hard refresh | Effects run after render; the store wasn't filled yet | `ready` flag; render a spinner until ready |
| Endless refetch loop | Object/array dependency in `useEffect` is new each render | Use a stable primitive (`JSON.stringify(params)`), `useMemo`, or primitives as deps |
| Stray `0` rendered on the page | `{count && <X/>}` with `count === 0` | `count > 0 && …` or a ternary returning `null` |
| ESLint `no-explicit-any` errors | `eslint-config-next/typescript` is strict | Type error bodies (`ApiErrorBody`), generics, `unknown` |
| ESLint warns about `window.location.href = "/"` | Next prefers the router for internal navigation | Intentional full reload outside React (401 handler); documented `eslint-disable-next-line` |
| `<a><button>` nesting | `<Link><Button/></Link>` | Styled `<Link>` |
| `CORS` errors from `:3001` | Laravel allowed only `FRONTEND_URL` (`:3000`) | `CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001` |
| Changed `NEXT_PUBLIC_API_BASE`, app still calls the old URL | Inlined at **build** time | Rebuild (or restart `next dev`) |
| Invite emails open the Nuxt app | `FRONTEND_URL` points at `:3000` | Point `FRONTEND_URL` at whichever frontend you deploy |

---

## 17. Next.js built-ins

### Components

| Component | Import | Purpose | Nuxt counterpart |
|---|---|---|---|
| `<Link>` | `next/link` | Client-side navigation, **prefetches** routes in the viewport (production), `replace`, `scroll`, `prefetch` props | `<NuxtLink>` |
| `<Image>` | `next/image` | Automatic resizing, lazy loading, modern formats, prevents layout shift (`width`/`height` or `fill`) | `<NuxtImg>` (`@nuxt/image`) |
| `<Script>` | `next/script` | Third-party scripts with `strategy`: `beforeInteractive`, `afterInteractive`, `lazyOnload`, `worker` | `useHead({ script })` / `useScript` |
| `<Form>` | `next/form` | `<form>` that navigates client-side with search params (search forms), prefetches the target | — |
| Fonts | `next/font/google`, `next/font/local` | Self-hosted fonts, no layout shift, CSS variables | `@nuxt/fonts` |

Used in this project: `<Link>`. (The scaffold's `next/font` Geist import was removed to
keep antd's default font stack.)

### File conventions (App Router)

| File | Purpose | Nuxt counterpart |
|---|---|---|
| `layout.tsx` | Shared UI, **preserved** across navigation | `layouts/*.vue` |
| `page.tsx` | Route UI, makes a segment public | `pages/*.vue` |
| `loading.tsx` | Automatic `<Suspense>` fallback for the segment | pending state / `<NuxtLoadingIndicator>` |
| `error.tsx` | Error boundary for the segment (Client Component, receives `error`, `reset`) | `<NuxtErrorBoundary>` |
| `global-error.tsx` | Errors in the root layout | `error.vue` |
| `not-found.tsx` | UI for `notFound()` and unmatched URLs | `error.vue` with 404 |
| `forbidden.tsx` / `unauthorized.tsx` | UI for `forbidden()` / `unauthorized()` | `createError({ statusCode: 403 })` |
| `template.tsx` | Like layout but **re-mounts** on every navigation | default Nuxt layout behaviour |
| `route.ts` | Route Handler (GET/POST… API endpoints) | `server/api/*.ts` |
| `default.tsx` | Fallback for parallel routes | — |
| `proxy.ts` | Runs before requests (redirects, rewrites, headers, auth) | server middleware / route middleware |
| `instrumentation.ts`, `instrumentation-client.ts` | Observability / startup hooks | Nitro plugins / client plugins |
| `opengraph-image.tsx`, `icon.tsx`, `sitemap.ts`, `robots.ts` | Generated metadata files | SEO modules |

### Functions and hooks

| API | Where | Purpose |
|---|---|---|
| `useRouter()` | Client | `push`, `replace`, `back`, `forward`, `refresh`, `prefetch` |
| `usePathname()` | Client | Current path (active nav links) |
| `useSearchParams()` | Client | Read query string |
| `useParams()` | Client | Dynamic params |
| `useSelectedLayoutSegment(s)` | Client | Active child segment (tabs/nav) |
| `useLinkStatus()` | Client | Pending state of a `<Link>` navigation |
| `redirect()` / `permanentRedirect()` | Server / Actions | Redirect while rendering |
| `notFound()`, `forbidden()`, `unauthorized()` | Server | Trigger the matching file UI |
| `cookies()`, `headers()` (async) | Server | Request data |
| `connection()` | Server | Opt into request-time rendering |
| `revalidatePath` / `revalidateTag` / `updateTag` / `refresh` | Server | Cache invalidation |
| `"use cache"`, `cacheLife`, `cacheTag` | Server | Cache Components caching |
| `generateMetadata`, `generateStaticParams` | Server | Dynamic metadata, prebuilt dynamic routes |
| `after()` | Server | Run work after the response is sent |
| `NextRequest` / `NextResponse` | Proxy / Route Handlers | Extended Request/Response |

---

## 18. Next.js concepts reference

### 18.1 Rendering

| Strategy | When it happens | How you get it |
|---|---|---|
| **Static (prerendered)** | At build time | Default when a route uses no request-time data (`○` in build output) |
| **Dynamic** | Per request | Using `cookies()`, `headers()`, `searchParams`, `connection()`, uncached data (`ƒ`) |
| **ISR / revalidation** | Static, refreshed in background | `revalidate` / `"use cache"` + `cacheLife`, `revalidateTag` |
| **Streaming** | Shell first, slow parts later | `<Suspense>` / `loading.tsx` |
| **Partial Prerendering / Cache Components** | Static shell + dynamic holes in one response | `cacheComponents: true`; dynamic parts under Suspense |
| **Client-side rendering** | In the browser | `"use client"` + data in effects (this project) |

Build output for this project: all pages are `○ Static` (the shells prerender; data loads
client-side) except the two dynamic-param routes (`ƒ`).

### 18.2 Data fetching options

| Option | Use for |
|---|---|
| `async` Server Component + `fetch`/DB | Page data, SEO, secrets stay on server |
| Server Actions (`"use server"` functions) | Mutations from forms/buttons without writing API routes; `useActionState`, `useFormStatus`, `useOptimistic` |
| Route Handlers (`app/api/.../route.ts`) | Public/webhook endpoints, a BFF/proxy to another API |
| Client fetching (`useEffect`, SWR, TanStack Query) | User-specific, interactive, token-in-browser data (this project) |
| `use(promise)` | Pass a promise from a Server to a Client Component and unwrap it under Suspense |

### 18.3 Hydration

Same idea as Nuxt: server HTML + client JS that attaches to it. React reports mismatches
(e.g. `Date.now()`, `typeof window` branches, `localStorage` during render, invalid HTML
nesting). Fix by making render output deterministic and moving browser-only reads into
`useEffect`. `suppressHydrationWarning` exists for unavoidable single-attribute
differences (like timestamps).

### 18.4 Caching (high level, Next 16)

- `fetch` in Server Components is **not cached by default** (changed in v15).
- With Cache Components, caching is **opt-in** with `"use cache"` on functions/components,
  tuned by `cacheLife()`, invalidated with `cacheTag` + `revalidateTag`/`updateTag`.
- The client **Router Cache** keeps visited/prefetched route payloads for instant back/forward.
- `router.refresh()` re-fetches Server Components for the current route.

### 18.5 Environment variables

| Variable | Available in | When resolved |
|---|---|---|
| `NEXT_PUBLIC_*` | Server + client | **Build time** (inlined) |
| Others | Server only | Runtime (`process.env`, after `connection()` for dynamic reads) |

Files: `.env`, `.env.local` (git-ignored, highest priority locally),
`.env.development`, `.env.production`.

### 18.6 TypeScript helpers

`next typegen` (also run by `dev`/`build`) generates global `PageProps<'/route'>`,
`LayoutProps<'/route'>`, `RouteContext<'/route'>` with typed, Promise-wrapped params, and
typed `<Link href>` routes. This plays the role of Nuxt's generated `.nuxt/` types.

---

## 19. Interview questions and answers

### React fundamentals (for Vue developers)

**1. How does React's reactivity differ from Vue's?**
Vue tracks dependencies at a fine-grained level through proxies and updates only what
read the changed ref. React re-runs the component function when its state (or parent)
changes and reconciles the virtual DOM diff. State in React is immutable: you replace it
via setters instead of mutating it.

**2. What are the Rules of Hooks and why do they exist?**
Call hooks only at the top level and only from components or custom hooks. React stores
hook state in a list indexed by call order. Conditional calls would shift the order and
attach state to the wrong hook. The `eslint-plugin-react-hooks` rules enforce this.

**3. `useState` vs `useRef`?**
`useState` triggers a re-render when updated; use it for anything shown in the UI.
`useRef` holds a mutable `.current` that persists across renders **without** re-rendering;
use it for DOM nodes, timers and previous values. (Vue's `ref` covers both roles.)

**4. When does `useEffect` run, and what is the dependency array for?**
After React commits the render to the screen. With `[]` it runs once after mount (like
`onMounted`); with `[a, b]` it runs when `a` or `b` change (`Object.is` comparison); with no
array, after every render. The returned cleanup runs before the next effect and on unmount.
In development, Strict Mode runs effects twice to surface missing cleanups.

**5. Do you need an effect for derived data?**
No. Compute it during render (`const fullName = first + ' ' + last`). Use `useMemo` only
for expensive work. Effects are for **synchronizing with external systems** (network,
DOM, subscriptions). Storing derived values in state with an effect causes extra renders
and bugs.

**6. `useMemo` vs `useCallback`?**
`useMemo(() => value, deps)` caches a computed value; `useCallback(fn, deps)` caches a
function identity (equal to `useMemo(() => fn, deps)`). Both matter mainly for referential
equality (effect deps, `memo`-ized children). With the React Compiler, much of this
memoization is automatic.

**7. Why do lists need `key`?**
Keys let React match elements between renders to preserve state and move DOM nodes
efficiently. Use stable IDs, not array indexes when items can reorder. antd's `rowKey="id"`
does this for table rows. Same concept as Vue's `:key`.

**8. Controlled vs uncontrolled inputs?**
Controlled: React state is the source of truth (`value` + `onChange`), as in this project.
Uncontrolled: the DOM holds the value; read it via a ref or `FormData` on submit. Server
Actions with `<form action>` work naturally with uncontrolled inputs.

**9. How do you replace `emit` and slots?**
Events become callback props (`onSuccess`). Default slots become `children`. Named slots
become props holding JSX (`extra={…}`). Scoped slots become render functions
(`render: (_, record) => …`).

**10. How do you share state globally?**
Context for low-frequency values (theme, auth user), or a store library (Zustand, Redux
Toolkit, Jotai) for frequently updated state. Context re-renders **all** consumers when its
value changes; Zustand selectors re-render only components whose selected slice changed.

**11. What's the stale closure problem?**
A callback captures state from the render it was created in. If it runs later (timeouts,
async `.then`), it sees old values. Fix with functional updates
(`setFormData(prev => …)`), refs, or correct effect dependencies.

**12. What's new in React 19 that matters here?**
Actions and `useActionState` / `useFormStatus` / `useOptimistic` for forms, `use()` to read
promises and context, `ref` as a regular prop (no `forwardRef`), document metadata tags,
and better hydration error messages. The React Compiler (stable) auto-memoizes.

### Next.js App Router

**13. Server Components vs Client Components?**
Server Components (the default) run only on the server, can be `async`, access secrets and
data directly, and send no JS. Client Components (`"use client"`) support state, effects and
browser APIs; they pre-render on the server and hydrate in the browser. Keep the client
boundary as low in the tree as possible.

**14. Does `"use client"` mean the component only renders on the client?**
No. It still pre-renders to HTML on the server; it also hydrates and runs in the browser.
For truly client-only rendering use `dynamic(() => import('./X'), { ssr: false })` from a
Client Component, or render after mount.

**15. Can a Client Component import a Server Component?**
Not directly (an import makes it client code). But a Client Component can **receive** a
Server Component as `children` or another prop from a Server parent. That's how
`AuthGuard` wraps server pages.

**16. How does routing work in the App Router?**
Folders are URL segments; `page.tsx` makes a segment routable; `layout.tsx` wraps
descendants and persists across navigation. Dynamic segments use `[id]`, catch-alls
`[...slug]`, route groups `(name)`, private folders `_name`. Parallel routes (`@slot`) and
intercepting routes (`(.)photo`) cover modals and split views.

**17. Why are `params` and `searchParams` Promises in Next 15/16?**
So Next can prerender as much of the page as possible and only wait for request data where
it's actually awaited, enabling streaming and Partial Prerendering. Await them in
`async` Server Components or unwrap with `use()` in Client Components.

**18. What is `proxy.ts` (formerly middleware)?**
Code that runs before a request completes (Node.js runtime in v16) to redirect, rewrite,
set headers or cookies, typically for auth gates, i18n and A/B tests. It runs on every
matching request, so keep it fast and filter with `matcher`.

**19. How would you protect routes in Next.js?**
Best: httpOnly session cookie, optimistic check in `proxy.ts`, authoritative checks in
Server Components/Actions and the API (data access layer). If the token lives in
`localStorage` (this project), use a client guard: wait for auth to load, then redirect.
Never rely on client checks alone for security; the API must enforce authorization (as
Laravel does here).

**20. `loading.tsx` vs `<Suspense>`?**
`loading.tsx` automatically wraps the segment's `page` in a Suspense boundary with that
fallback. `<Suspense>` gives finer-grained control around specific components.

**21. How does `error.tsx` work?**
It's a React error boundary (must be a Client Component) for its segment, receiving
`error` and `reset()`. Errors in the root layout need `global-error.tsx`. `notFound()`
renders the nearest `not-found.tsx`.

**22. What are Server Actions?**
Async functions marked `"use server"`, callable from forms (`<form action={fn}>`) or client
code. They run on the server, can mutate data and revalidate caches, and work with
progressive enhancement. They replace many hand-written API routes. Always validate
input and check authorization inside them.

**23. Route Handlers vs Server Actions?**
Route Handlers (`route.ts`) are HTTP endpoints for external callers, webhooks, non-form
clients and file downloads. Server Actions are for your own UI's mutations and are tied to
the React tree.

**24. How does caching work in Next 16?**
`fetch` isn't cached by default. With Cache Components, opt in via `"use cache"` and
control lifetime with `cacheLife`, tagging with `cacheTag`, invalidation with
`revalidateTag` / `updateTag` / `revalidatePath`. The client Router Cache stores route
payloads for fast navigations; `router.refresh()` bypasses it for the current route.

**25. What are Cache Components and why did this project disable them?**
A mode where routes prerender a static shell and anything request-dependent must be either
cached (`"use cache"`) or inside `<Suspense>`. Non-deterministic values (`Math.random()`,
`Date.now()`) during prerender are errors. `AntdRegistry` uses a random id, and all data
here is client-side, so the feature added constraints without benefit.

**26. How do environment variables differ from Nuxt's runtime config?**
`NEXT_PUBLIC_*` values are inlined into the client bundle at build time. Server-only
variables are read at runtime. Nuxt's `runtimeConfig.public` can be overridden when the
server starts without rebuilding. Next 16 removed `publicRuntimeConfig`.

**27. How do you set page titles and SEO tags?**
Export `metadata` (static) or `generateMetadata()` (dynamic, can await params/data) from
`layout.tsx`/`page.tsx` (Server Components only). `title.template` in a parent layout
composes titles. File conventions generate OG images, icons, `sitemap.xml`, `robots.txt`.

**28. How does `<Link>` prefetching work?**
In production, links in the viewport prefetch route data. Static routes are fully
prefetched; dynamic routes prefetch down to the nearest `loading.tsx`. Control with
`prefetch={false|true}`. With Partial Prefetching, links prefetch a shared per-route App
Shell.

**29. Layout vs template?**
Layouts persist across navigations between child routes (state kept, effects not re-run).
Templates create a new instance on each navigation (re-mount, effects re-run), which is
useful for enter animations or per-page logging.

**30. What does `"use client"` do to imported code size, and how do you keep bundles small?**
Everything imported by a client module ships to the browser. Keep heavy logic and data
formatting in Server Components, push `"use client"` to leaf components, use
`next/dynamic` for heavy client-only widgets, and import library components individually
(antd is tree-shakable).

### Vue/Nuxt ↔ React/Next comparison questions

**31. Compare Nuxt and Next.js.**
Both offer file routing, layouts, SSR/SSG/hybrid rendering and server endpoints. Nuxt
favours convention and auto-imports, uses Vue, and its Nitro server deploys anywhere via
presets. Next is React-based, centred on React Server Components, Server Actions and
fine-grained caching, with first-class Vercel integration (but self-hostable with
`next start`, Docker, or adapters).

**32. Compare Pinia and Zustand.**
Both are small, TypeScript-friendly, hook/composable-based stores without boilerplate.
Pinia relies on Vue reactivity (mutate state, computed getters, devtools integration).
Zustand stores immutable state updated via `set`, read with selectors, and works
outside React through `getState`.

**33. Composables vs hooks?**
Same idea: functions encapsulating reusable stateful logic. Composables run once in setup
and return reactive refs. Hooks run every render, return plain values, and must follow the
Rules of Hooks. Watchers become effects with dependency arrays.

**34. What changes in how you think about forms?**
Vue's `v-model` gives two-way binding for free. React makes data flow explicit: value
down, change events up (or uncontrolled forms with `FormData`/Server Actions). For
complex forms, use antd's `Form` instance (`Form.useForm`) or React Hook Form.

**35. Where do Nuxt's `useFetch` features live in Next?**
SSR data + no double fetch → `async` Server Components (data is in the RSC payload,
not refetched on hydration). Client-side caching, dedupe, refresh → SWR / TanStack Query.
Mutations + refresh → Server Actions + `revalidatePath` / `router.refresh()`.

---

## 20. Migration checklist

- [ ] Scaffold with `create-next-app` (App Router, TS, `src/`); install React versions of
      your UI kit and a store
- [ ] Review `next.config.ts` defaults (Cache Components, Partial Prefetching) against your
      data strategy
- [ ] Root `layout.tsx`: `<html>/<body>`, global CSS, `metadata` (title template), style
      registry (antd/emotion/styled-components), client `Providers`
- [ ] Replace `runtimeConfig.public` with `NEXT_PUBLIC_*` (remember: build-time)
- [ ] Port the HTTP client (`fetch` doesn't throw on 4xx/5xx)
- [ ] Composables → hooks (`ref` → `useState`, `watch` → `useEffect` with deps,
      `computed` → derive in render)
- [ ] Pinia → Zustand (or Context); move browser-only reads into effects; add a `ready` flag
      if guards depend on async init
- [ ] `pages/` → `app/**/page.tsx`; `[param].vue` → `[param]/page.tsx`; await `params`
- [ ] Layouts → nested `layout.tsx` + route groups
- [ ] Route middleware → `proxy.ts` (cookie auth) or a client guard component (localStorage auth)
- [ ] Templates → JSX: `v-if` → ternaries/`&&` (watch for `0`), `v-for` → `.map` with keys,
      `v-model` → `value`/`onChange`, emits → callback props, slots → `children`/props/render fns
- [ ] Mark interactive components `"use client"`; keep pages as Server Components for metadata
- [ ] `<NuxtLink>` → `<Link>`, `navigateTo` → `useRouter()` / `redirect()`
- [ ] Backend: allow the new origin in CORS; update links emailed to users
- [ ] `tsc --noEmit`, `npm run lint`, `npm run build`
- [ ] Test hard refresh on protected routes, role redirects, login/logout, dynamic routes,
      pagination, filters, validation errors, downloads
