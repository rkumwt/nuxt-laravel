# Migrating a Vue 3 SPA to Nuxt 4 — A Practical Guide

This guide walks through how the **URL Shortener** frontend was moved from a Vue 3 SPA
that lived inside Laravel (`resources/js`) to a standalone **Nuxt 4** app (`frontend/`).
Every piece of the original code is mapped to its Nuxt replacement, with the reasoning
behind each change. The guide ends with the Nuxt built-ins and concepts it relies on,
plus common interview questions.

> Source project: [rkumwt/url-shortner](https://github.com/rkumwt/url-shortner) (Laravel + Vue).
> Result: `backend/` (Laravel API) + `frontend/` (Nuxt 4).

---

## Table of Contents

1. [Why migrate to Nuxt?](#1-why-migrate-to-nuxt)
2. [Architecture: before and after](#2-architecture-before-and-after)
3. [File-by-file migration map](#3-file-by-file-migration-map)
4. [Step 1 — Create the Nuxt project](#4-step-1--create-the-nuxt-project)
5. [Step 2 — `nuxt.config.ts` replaces `vite.config.js` + `app.js`](#5-step-2--nuxtconfigts-replaces-viteconfigjs--appjs)
6. [Step 3 — Root component and layouts](#6-step-3--root-component-and-layouts)
7. [Step 4 — Plugins (Ant Design Vue, bootstrapping auth)](#7-step-4--plugins)
8. [Step 5 — HTTP layer: axios instances → `$fetch`](#8-step-5--http-layer-axios-instances--fetch)
9. [Step 6 — Composables](#9-step-6--composables)
10. [Step 7 — Pinia store](#10-step-7--pinia-store)
11. [Step 8 — Routing: `vue-router` config → file-based pages](#11-step-8--routing-vue-router-config--file-based-pages)
12. [Step 9 — Navigation guards → route middleware](#12-step-9--navigation-guards--route-middleware)
13. [Step 10 — Components and pages](#13-step-10--components-and-pages)
14. [Step 11 — Backend changes needed for a separate frontend](#14-step-11--backend-changes-needed-for-a-separate-frontend)
15. [Pitfalls hit during this migration](#15-pitfalls-hit-during-this-migration)
16. [Nuxt built-in components used (and other useful ones)](#16-nuxt-built-in-components)
17. [Nuxt concepts reference](#17-nuxt-concepts-reference)
18. [Interview questions and answers](#18-interview-questions-and-answers)
19. [Migration checklist](#19-migration-checklist)

---

## 1. Why migrate to Nuxt?

| Concern | Plain Vue SPA | Nuxt |
|---|---|---|
| Routing | Hand-written `routes` array | Generated from the `pages/` folder |
| Imports | Import every component/composable manually | Auto-imports for Vue APIs, components, composables, utils |
| Layouts | Nested route with a layout component | `layouts/` + `<NuxtLayout>` + `definePageMeta({ layout })` |
| Route guards | `router.beforeEach` in one big file | Per-page or global middleware files |
| Config / env | `window.config` injected from Blade | `runtimeConfig`, overridable through `NUXT_*` env vars |
| Rendering | Client-only | CSR, SSR, SSG, or hybrid per route (`routeRules`) |
| Deployment | Coupled to Laravel's `public/` build | Independent: Node server (Nitro), static, serverless, edge |
| Data fetching | axios | `$fetch`, `useFetch`, `useAsyncData` (SSR-aware) |

In this project the main gain is **decoupling**: the frontend no longer depends on a
Blade view, Laravel's Vite plugin or a catch-all web route. It can be deployed, scaled
and versioned separately from the API.

---

## 2. Architecture: before and after

### Before (Vue inside Laravel)

```
Browser ──► Laravel (php artisan serve :8000)
              ├── GET /{any}      → app.blade.php → @vite('resources/js/app.js') → Vue SPA
              ├── GET /s/{code}   → redirect to long URL
              └── POST /api/*     → JSON API (Sanctum bearer token)
```

- `app.blade.php` injected `window.config.base_url` so the SPA knew where the API was.
- `vite.config.js` used `laravel-vite-plugin`, `@vitejs/plugin-vue` and
  `unplugin-vue-components` (to auto-import Ant Design Vue components).
- Same origin, so **no CORS** was needed.

### After (separate apps)

```
Browser ──► Nuxt (:3000)  — UI, routing, auth guard
   │
   └──(fetch + Bearer token, CORS)──► Laravel (:8000)
                                         ├── POST /api/*   → JSON API
                                         └── GET  /s/{code} → redirect
```

- Nuxt reads the API URL from `runtimeConfig.public.apiBase`.
- Laravel now needs **CORS**, and invite links must point at the **frontend** URL.

---

## 3. File-by-file migration map

| Vue (`resources/js/…`) | Nuxt (`frontend/app/…`) | What changed |
|---|---|---|
| `app.js` | `nuxt.config.ts` + `plugins/*` | Nuxt creates the app; we hook in through plugins |
| `views/App.vue` | `app.vue` | `<router-view>` → `<NuxtLayout><NuxtPage/></NuxtLayout>` |
| `../views/app.blade.php` | *(gone)* | Nuxt generates the HTML shell; title set in `app.head` |
| `../css/app.css` | `assets/css/main.css` | Registered via `css: []` in config |
| `plugins/axiosBase.js`, `axiosAdmin.js`, `axiosFile.js` | `composables/useApi.ts` | One `$fetch.create()` instance; blob handled with `responseType` |
| `composable/apiAdmin.js` | `composables/useApiRequest.ts` | Same API (`loading`, `rules`, `apiRequest`), uses `$fetch` |
| `composable/datatable.js` | `composables/useDatatable.ts` | Same API + `loading` + `reload()` |
| download code in two `urls/index.vue` | `composables/useDownload.ts` | Duplicate code extracted |
| `rangePresets` in two `fields.js` | `composables/useRangePresets.ts` | Duplicate code extracted |
| `stores/auth.js` | `stores/auth.ts` | Uses `navigateTo` instead of the router import |
| `utils/localStorageKeys.js` | `utils/storageKeys.ts` | Auto-imported util |
| `router/index.js`, `admin.js`, `superadmin.js` | `pages/**` | File-based routes |
| `router.beforeEach(...)` | `middleware/auth.global.ts` | Global route middleware |
| route `meta: {...}` | `definePageMeta({...})` in each page | Meta lives with the page |
| `views/layouts/Layout.vue` | `layouts/default.vue` | `<router-view/>` → `<slot/>` |
| *(implicit: no layout)* | `layouts/blank.vue` | Login and invite pages use `layout: 'blank'` |
| `views/layouts/AdminMenus.vue` | `components/layout/AdminMenus.vue` | Auto-imported as `<LayoutAdminMenus>` |
| `views/layouts/SuperadminMenus.vue` | `components/layout/SuperadminMenus.vue` | `<LayoutSuperadminMenus>` |
| `views/components/Logout.vue` | `components/layout/Logout.vue` | `<LayoutLogout>` |
| `views/Login.vue` | `pages/index.vue` | Route `/` |
| `views/InviteRegister.vue` | `pages/invite/[code].vue` | Dynamic param `code` |
| `views/superadmin/Dashboard.vue` | `pages/superadmin/dashboard.vue` | |
| `views/superadmin/clients/index.vue` + `fields.js` | `components/superadmin/Clients.vue` | Columns inlined |
| `views/superadmin/clients/Invite.vue` | `components/superadmin/ClientInvite.vue` | |
| `views/superadmin/urls/index.vue` + `fields.js` | `components/superadmin/ShortUrls.vue` + `pages/superadmin/urls/index.vue` + `pages/superadmin/urls/[client_id].vue` | Client id passed as a prop |
| `views/admin/Dashboard.vue` | `pages/admin/dashboard.vue` | |
| `views/admin/urls/index.vue` + `fields.js` | `components/admin/ShortUrls.vue` | |
| `views/admin/urls/GenerateUrl.vue` | `components/admin/GenerateUrl.vue` | |
| `views/admin/team-members/index.vue` + `fields.js` | `pages/admin/team-members.vue` | |
| `views/admin/team-members/Invite.vue` | `components/admin/TeamMemberInvite.vue` | |

### Final Nuxt tree

```
frontend/
├── nuxt.config.ts
├── .env / .env.example          # NUXT_PUBLIC_API_BASE
└── app/
    ├── app.vue
    ├── assets/css/main.css
    ├── components/
    │   ├── admin/      GenerateUrl.vue, ShortUrls.vue, TeamMemberInvite.vue
    │   ├── layout/     AdminMenus.vue, Logout.vue, SuperadminMenus.vue
    │   └── superadmin/ ClientInvite.vue, Clients.vue, ShortUrls.vue
    ├── composables/    useApi.ts, useApiRequest.ts, useDatatable.ts,
    │                   useDownload.ts, useRangePresets.ts
    ├── layouts/        default.vue, blank.vue
    ├── middleware/     auth.global.ts
    ├── pages/
    │   ├── index.vue                    → /
    │   ├── invite/[code].vue            → /invite/:code
    │   ├── admin/dashboard.vue          → /admin/dashboard
    │   ├── admin/team-members.vue       → /admin/team-members
    │   ├── superadmin/dashboard.vue     → /superadmin/dashboard
    │   ├── superadmin/urls/index.vue    → /superadmin/urls
    │   └── superadmin/urls/[client_id].vue → /superadmin/urls/:client_id
    ├── plugins/        01.antd.ts, 02.auth.ts
    ├── stores/         auth.ts
    └── utils/          homeRoute.ts, storageKeys.ts
```

> **Nuxt 4 note:** application code lives under `app/` (the `srcDir`). `server/`,
> `public/` and `nuxt.config.ts` stay at the project root. In Nuxt 3 everything sat at the root.

---

## 4. Step 1 — Create the Nuxt project

```bash
npx nuxi@latest init frontend --template minimal --packageManager npm
cd frontend
npm install ant-design-vue@^4 @ant-design/icons-vue dayjs pinia @pinia/nuxt
npm install -D typescript@^5 vue-tsc     # for `npx nuxi typecheck`
```

What is **not** carried over from `package.json`:

| Old dependency | Why it's gone |
|---|---|
| `vue-router` (direct) | Nuxt ships and configures vue-router itself |
| `axios` | Replaced by Nuxt's built-in `$fetch` (ofetch) |
| `laravel-vite-plugin` | No longer built by Laravel |
| `@vitejs/plugin-vue` | Built into Nuxt |
| `unplugin-vue-components` | Nuxt auto-imports components; Antd registered globally |
| `vite` (direct) | Nuxt bundles Vite |

> **Gotcha:** `vue-tsc` did not work with TypeScript 7 at the time of writing
> (`ERR_PACKAGE_PATH_NOT_EXPORTED ... './lib/tsc'`). Pin `typescript@^5`.

---

## 5. Step 2 — `nuxt.config.ts` replaces `vite.config.js` + `app.js`

### Before

```js
// vite.config.js
export default defineConfig({
    plugins: [
        laravel({ input: ['resources/css/app.css', 'resources/js/app.js'], refresh: true }),
        vue(),
        tailwindcss(),
        Components({ resolvers: [AntDesignVueResolver({ importStyle: false })] }),
    ],
    resolve: { alias: { '@': path.resolve(__dirname, 'resources/js') } },
});
```

```js
// app.js
import './plugins';
import '../css/app.css'
import { createApp } from 'vue'
import App from '@/views/App.vue'
import { router } from '@/router'
import { createPinia } from "pinia";
import { useAuthStore } from '@/stores/auth';

const bootstarp = async () => {
    const app = createApp(App);
    const pinia = createPinia();
    app.use(pinia);

    const authStore = useAuthStore();
    await authStore.updateUserAction();   // load user before router

    app.use(router);
    app.mount('#app')
}
bootstarp();
```

```html
<!-- app.blade.php -->
<title>URL Shortner</title>
@vite('resources/js/app.js')
<div id="app"></div>
<script>window.config = { base_url: "{{ route('app', '/') }}" }</script>
```

### After

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  // Auth token lives in localStorage, so the app runs as a client-side SPA
  ssr: false,

  modules: ['@pinia/nuxt'],

  css: ['ant-design-vue/dist/reset.css', '~/assets/css/main.css'],

  app: {
    head: {
      title: 'URL Shortner',
    },
  },

  runtimeConfig: {
    public: {
      // Override with NUXT_PUBLIC_API_BASE
      apiBase: 'http://localhost:8000/api',
    },
  },
})
```

```bash
# .env
NUXT_PUBLIC_API_BASE=http://localhost:8000/api
```

### Explanation

| Old | New | Notes |
|---|---|---|
| `createApp(App)` / `app.mount('#app')` | done by Nuxt | You never call `createApp` in Nuxt |
| `app.use(pinia)` | `modules: ['@pinia/nuxt']` | The module installs Pinia and auto-imports `defineStore`, `storeToRefs` |
| `app.use(router)` | automatic | Nuxt builds the router from `pages/` |
| `import '../css/app.css'` | `css: [...]` | Global CSS, loaded on every page |
| `@` alias → `resources/js` | `~` / `@` → `app/` | Built-in aliases; `~~` / `@@` point at the project root |
| `window.config.base_url` | `runtimeConfig.public.apiBase` | Read with `useRuntimeConfig()`. Env var `NUXT_PUBLIC_API_BASE` overrides it **at runtime**, no rebuild needed (when running the Node server) |
| `<title>` in Blade | `app.head.title` | Per-page titles use `useHead()` / `useSeoMeta()` |
| `await authStore.updateUserAction()` before router | async plugin `02.auth.ts` | See [Step 4](#7-step-4--plugins) |

**Why `ssr: false`?** The original app keeps the token in `localStorage`, which exists
only in the browser. With SSR the server would render every protected page as logged out,
and the client would then redirect, causing flashes and hydration mismatches. A dashboard
behind a login gains nothing from SEO, so a client-rendered SPA is the honest choice. To
enable SSR later, store the token in a cookie (`useCookie`) so the server can read it.

**`runtimeConfig` keys:** anything under `public` reaches the browser. Top-level keys
(e.g. `runtimeConfig.apiSecret`) stay on the server only.

---

## 6. Step 3 — Root component and layouts

### Before

```vue
<!-- views/App.vue -->
<template>
    <div><router-view /></div>
</template>
```

The layout was a **parent route** whose children rendered into its `<router-view/>`:

```js
// router/admin.js
const routes = [{
    path: "/",
    component: () => import("@/views/layouts/Layout.vue"),
    children: [ { path: "/admin/dashboard", ... }, ... ]
}];
```

### After

```vue
<!-- app/app.vue -->
<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
```

```vue
<!-- app/layouts/default.vue -->
<template>
    <a-layout class="layout">
        <a-layout-header :style="{ background: '#fff', padding: '0 50px' }">
            <a-row>
                <a-col :span="12">
                    <a-row>
                        <a-col :span="6">
                            <span style="font-weight: bolder">
                                {{ authStore.user?.company?.name }}
                            </span>
                        </a-col>
                        <a-col :span="18">
                            <LayoutSuperadminMenus
                                v-if="authStore.user?.type === 'superadmin'"
                            />
                            <LayoutAdminMenus
                                v-if="['admin', 'member'].includes(authStore.user?.type ?? '')"
                            />
                        </a-col>
                    </a-row>
                </a-col>
                <a-col :span="12" :style="{ textAlign: 'right' }">
                    <LayoutLogout />
                </a-col>
            </a-row>
        </a-layout-header>
        <a-layout-content style="padding: 0 50px; min-height: 100vh">
            <slot />
        </a-layout-content>
    </a-layout>
</template>

<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

const authStore = useAuthStore();
</script>
```

```vue
<!-- app/layouts/blank.vue -->
<template>
    <slot />
</template>
```

### Explanation

- `<NuxtLayout>` renders the layout the current page asks for (`default` unless
  `definePageMeta({ layout: 'blank' })` says otherwise).
- `<NuxtPage>` is Nuxt's wrapper around `<RouterView>`. It adds transitions,
  `<Suspense>`, `keepalive` and page-key handling.
- In a layout, the page goes into **`<slot />`**, not `<router-view />`.
- Layouts are not routes, so the fake `path: "/"` parent route trick disappears.
- `LayoutAdminMenus` etc. need no import: `components/layout/AdminMenus.vue` is
  **auto-imported** under a name built from its path (`layout/` + `AdminMenus`).
- Leftover dead CSS in `Layout.vue` (`#components-layout-demo-top .logo`, a stray `å` in a
  style) was dropped.

---

## 7. Step 4 — Plugins

Nuxt plugins in `app/plugins/` run **before the app mounts**. Files load in
alphabetical order, so a numeric prefix (`01.`, `02.`) controls the order.

### 7.1 Ant Design Vue

Before, `unplugin-vue-components` resolved `<a-button>` etc. at build time. The simplest
Nuxt equivalent is to register Antd globally:

```ts
// app/plugins/01.antd.ts
import Antd from 'ant-design-vue'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(Antd)
})
```

- `nuxtApp.vueApp` is the underlying Vue app, the same object `createApp()` returned
  before. Anything you used to `app.use(...)` goes here.
- Antd's reset stylesheet is added in `nuxt.config.ts` → `css`.
- **Trade-off:** global registration ships all of Antd (the build warns about a large
  chunk). For tree-shaking, use the official `@ant-design-vue/nuxt` module or keep
  `unplugin-vue-components` via `vite.plugins` in `nuxt.config.ts`.

### 7.2 Loading the user before the first navigation

```ts
// app/plugins/02.auth.ts
import { useAuthStore } from '~/stores/auth'

// Load the logged-in user before the first route guard runs
export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore()
  await authStore.fetchUser()
})
```

This replaces the `await authStore.updateUserAction()` call inside `bootstarp()`.
Nuxt **awaits async plugins** before running route middleware for the initial
navigation. So when `auth.global.ts` runs, `authStore.user` is already loaded and the
role checks (`allowedUserType`) work on a hard refresh.

**Plugin variants worth knowing:**

| File name | Runs on |
|---|---|
| `foo.ts` | client and server |
| `foo.client.ts` | client only |
| `foo.server.ts` | server only |

Plugins can also `provide` helpers: `return { provide: { api } }` exposes `useNuxtApp().$api`.

---

## 8. Step 5 — HTTP layer: axios instances → `$fetch`

### Before — three axios instances on `window`

```js
// plugins/axiosAdmin.js (axiosBase and axiosFile were near-copies)
var axiosAdmin = axios.create({ baseURL: window.config.base_url + '/api' });
axiosAdmin.defaults.headers['Accept'] = 'application/json';
axiosAdmin.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

axiosAdmin.interceptors.request.use((config) => {
    const authToken = window.localStorage.getItem(AUTH_TOKEN);
    if (authToken) config.headers['Authorization'] = `Bearer ${authToken}`;
    return config;
});

axiosAdmin.interceptors.response.use(function (response) {
    return response.data;               // unwrap
}, function (error) {
    const errorCode = error.response.status;
    if (errorCode === 401) {
        window.localStorage.clear();
        window.location.href = window.config.base_url;
    } else if (errorCode === 403) {
        message.error(error.response.data.message || 'Forbidden');
        return Promise.reject(error.response);
    } else {
        return Promise.reject(error.response);
    }
});

window.axiosAdmin = axiosAdmin;          // global!
```

- `axiosBase`: same, without the token.
- `axiosFile`: same, but returned the full response (needed for blobs).

### After — one composable

```ts
// app/composables/useApi.ts
import { message } from 'ant-design-vue'
import { AUTH_TOKEN } from '~/utils/storageKeys'

export interface ApiResponse<T = any> {
  status: boolean
  message: string
  data: T
}

// $fetch instance for the Laravel API: adds the bearer token and handles 401/403
export const useApi = () => {
  const config = useRuntimeConfig()

  return $fetch.create({
    baseURL: config.public.apiBase,
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    onRequest({ options }) {
      const token = localStorage.getItem(AUTH_TOKEN)
      if (token) {
        options.headers.set('Authorization', `Bearer ${token}`)
      }
    },
    onResponseError({ response }) {
      if (response.status === 401) {
        localStorage.clear()
        // Full reload resets the store and lands on login
        window.location.href = '/'
      } else if (response.status === 403) {
        message.error(response._data?.message || 'Forbidden')
      }
    },
  })
}
```

### Explanation

| axios concept | `$fetch` (ofetch) equivalent |
|---|---|
| `axios.create({ baseURL })` | `$fetch.create({ baseURL })` |
| `defaults.headers` | `headers` in the create options |
| request interceptor | `onRequest({ options })` hook |
| response error interceptor | `onResponseError({ response })` hook |
| `response.data` unwrap interceptor | not needed: `$fetch` **returns the parsed body** |
| `error.response.data` | `error.data` (FetchError); in hooks `response._data` |
| `data` argument of `.post(url, data)` | `body` option |
| `responseType: 'blob'` | `responseType: 'blob'` (same name) |
| `window.axiosAdmin` global | `useApi()` composable, auto-imported, typed |

**Why `method: 'POST'` as the default?** Every endpoint of this Laravel API is a `POST`,
including the list endpoints, so the default saves repetition.

**Why one instance instead of three?**
- `axiosBase` vs `axiosAdmin`: the only difference was the token. Sending no header when
  there's no token covers both.
- `axiosFile`: existed only to return the full response for blobs. `$fetch` returns
  whatever `responseType` asks for, so the same instance works.

**Why not `useFetch`?** `useFetch`/`useAsyncData` are built for **loading data during
component setup**, with SSR payload transfer and deduplication. This app makes requests
from event handlers (submit, paginate, download) and runs without SSR, so plain `$fetch`
is the right tool. See [Q&A](#18-interview-questions-and-answers).

---

## 9. Step 6 — Composables

Files in `app/composables/` are **auto-imported** (top-level files only, by default),
so pages call `useApiRequest()` with no import statement.

### 9.1 `apiAdmin.js` → `useApiRequest.ts`

**Before**

```js
const apiAdmin = () => {
    const axiosAdmin = window.axiosAdmin;
    const rules = ref({});
    const loading = ref(false);

    const apiRequest = (configObject) => {
        const { url, data } = configObject;
        loading.value = true;
        rules.value = {};

        axiosAdmin.post(url, data)
            .then((res) => {
                loading.value = false;
                rules.value = {};
                if (configObject.success) configObject.success(res);
            })
            .catch((error) => {
                rules.value = error.data && error.data.errors ? error.data.errors : {};
                loading.value = false;
                if (configObject.error) configObject.error(error);
            });
    }
    return { rules, loading, apiRequest }
}
export default apiAdmin;
```

**After**

```ts
// app/composables/useApiRequest.ts
import type { ApiResponse } from './useApi'

interface ApiRequestConfig {
  url: string
  data?: Record<string, any>
  success?: (res: ApiResponse) => void
  error?: (err: { status?: number, data?: any }) => void
}

// Form submit helper: tracks loading and exposes Laravel validation errors as `rules`
export const useApiRequest = () => {
  const api = useApi()
  const rules = ref<Record<string, string[]>>({})
  const loading = ref(false)

  const apiRequest = async (configObject: ApiRequestConfig) => {
    const { url, data } = configObject
    loading.value = true
    rules.value = {}

    try {
      const res = await api<ApiResponse>(url, { body: data ?? {} })
      loading.value = false

      configObject.success?.(res)
    } catch (err: any) {
      rules.value = err?.data?.errors ?? {}
      loading.value = false

      configObject.error?.({ status: err?.status, data: err?.data })
    }
  }

  return {
    rules,
    loading,
    apiRequest,
  }
}
```

**Notes**

- **Same public API** (`rules`, `loading`, `apiRequest({ url, data, success, error })`),
  so the page code barely changes.
- `error` receives `{ status, data }`, the same shape axios's `error.response` had, so
  `err.data.message` in `InviteRegister` still works.
- Laravel returns `422` with `{ errors: { field: [msg] } }`. `rules.email[0]` feeds
  Antd's `:help` / `:validateStatus`. This pattern is unchanged.
- The `use` prefix is the composable naming convention. Nuxt auto-imports any export
  from `composables/`, but the prefix tells readers it must run in a setup context.

### 9.2 `datatable.js` → `useDatatable.ts`

```ts
// app/composables/useDatatable.ts
import type { TablePaginationConfig } from 'ant-design-vue'
import type { ApiResponse } from './useApi'

interface Paginated<T> {
  data: T[]
  meta: { current_page: number, last_page: number, per_page: number, total: number }
}

export const useDatatable = <T = any>() => {
  const api = useApi()
  const data = ref<T[]>([]) as Ref<T[]>
  const loading = ref(false)
  const pageSize = ref(10)
  const currentPage = ref(1)
  const tablePagination = ref<TablePaginationConfig>({
    pageSize: pageSize.value,
    showSizeChanger: true,
  })
  const url = ref('')
  const params = ref<Record<string, any>>({})

  const fetchData = async () => {
    loading.value = true
    try {
      const res = await api<ApiResponse<Paginated<T>>>(url.value, {
        body: { per_page: pageSize.value, page: currentPage.value, ...params.value },
      })
      data.value = res.data.data
      tablePagination.value = {
        ...tablePagination.value,
        current: res.data.meta.current_page,
        total: res.data.meta.total,
      }
    } finally {
      loading.value = false
    }
  }

  const handleTableChange = (pagination: TablePaginationConfig) => {
    pageSize.value = pagination.pageSize ?? 10
    currentPage.value = pagination.current ?? 1
    tablePagination.value = { ...pagination }
    fetchData()
  }

  // Reset to the first page, e.g. after a filter change
  const reload = () => {
    currentPage.value = 1
    return fetchData()
  }

  return { url, params, data, loading, tablePagination, fetchData, reload, handleTableChange }
}
```

**Improvements over the original:**
- `loading` drives the table's `:loading` spinner.
- `reload()` resets to page 1. Previously, changing a date filter while on page 20 could
  request a page that no longer existed in the filtered set.
- `current` is synced from the server's `meta.current_page`.
- Generic `<T>` gives typed rows if you want them.

### 9.3 Extracted: `useDownload.ts`

The CSV download block was copy-pasted in both `urls/index.vue` files and used the global
`axiosFile`. It is now one composable:

```ts
// app/composables/useDownload.ts
// POSTs to a download endpoint and saves the returned file
export const useDownload = () => {
  const api = useApi()
  const downloading = ref(false)

  const download = async (url: string, payload: Record<string, any>, fileName: string, docType = 'text/csv') => {
    downloading.value = true
    try {
      const response = await api<Blob>(url, { body: payload, responseType: 'blob' })

      const blob = new Blob([response], { type: docType })
      const objectUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()

      document.body.removeChild(link)
      window.URL.revokeObjectURL(objectUrl)
    } catch {
      // Errors are surfaced by the api interceptor
    } finally {
      downloading.value = false
    }
  }

  return { downloading, download }
}
```

### 9.4 Extracted: `useRangePresets.ts`

```ts
// app/composables/useRangePresets.ts
import dayjs from 'dayjs'

export const useRangePresets = () => [
  { label: 'Last 7 Days', value: [dayjs().add(-7, 'd'), dayjs()] },
  { label: 'Last 14 Days', value: [dayjs().add(-14, 'd'), dayjs()] },
  { label: 'Last 30 Days', value: [dayjs().add(-30, 'd'), dayjs()] },
  { label: 'Last 90 Days', value: [dayjs().add(-90, 'd'), dayjs()] },
]
```

The original wrapped these in `ref()`. They never change, so a plain array is enough.

### 9.5 Utils

```ts
// app/utils/storageKeys.ts
export const AUTH_USER = 'auth_user'
export const AUTH_TOKEN = 'auth_token'
```

```ts
// app/utils/homeRoute.ts
export type UserType = 'superadmin' | 'admin' | 'member'

export interface AuthUser {
  id: number
  name: string
  type: UserType
  status: string
  company_id: number
  company?: { id: number, name: string }
}

// Landing page for a user after login
export const homeRouteFor = (user?: AuthUser | null) =>
  user?.type === 'superadmin' ? '/superadmin/dashboard' : '/admin/dashboard'
```

`homeRouteFor` replaces the ternary
`user.type === "superadmin" ? "superadmin.dashboard" : "admin.dashboard"`, which was
repeated **three times** (Login.vue and twice in `router/index.js`).

> **Bug spotted while migrating:** the original imported `@/utils/localstorageKeys`
> (lowercase *s*) while the file is `localStorageKeys.js`. It works on macOS
> (case-insensitive file system) but **fails on Linux CI/servers**.

---

## 10. Step 7 — Pinia store

### Before

```js
import { router } from "@/router";               // store imports the router

export const useAuthStore = defineStore('auth', () => {
    const user = ref(null);
    const authToken = ref(getValueFromLocalStorage(AUTH_TOKEN));
    const isLoggedIn = computed(() => authToken.value === null || authToken.value === "" ? false : true);

    const updateAuthToken = (newVal) => {
        authToken.value = newVal;
        window.localStorage.setItem(AUTH_TOKEN, newVal);   // stores the string "null" on logout
    }

    const updateUserAction = async () => {
        if (authToken.value) {
            const response = await window.axiosAdmin.post('/user')
            console.log(response.data.user);
            updateUser(response.data.user)
        }
    }

    const logoutAction = () => {
        if (authToken.value) {
            window.axiosAdmin.post('/logout').then(function () {
                window.localStorage.clear();
                updateAuthToken(null);
                updateUser(null);
                router.push({ name: "login" });
            }).catch(function (error) { });
        }
    }
    ...
})
```

### After

```ts
// app/stores/auth.ts
import { defineStore } from 'pinia'
import { AUTH_TOKEN } from '~/utils/storageKeys'
import type { AuthUser } from '~/utils/homeRoute'
import type { ApiResponse } from '~/composables/useApi'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const authToken = ref<string | null>(localStorage.getItem(AUTH_TOKEN) || null)

  const isLoggedIn = computed(() => !!authToken.value)

  const updateUser = (newVal: AuthUser | null) => {
    user.value = newVal
  }

  const updateAuthToken = (newVal: string | null) => {
    authToken.value = newVal
    if (newVal) {
      localStorage.setItem(AUTH_TOKEN, newVal)
    } else {
      localStorage.removeItem(AUTH_TOKEN)
    }
  }

  const fetchUser = async () => {
    if (!authToken.value) return
    try {
      const api = useApi()
      const response = await api<ApiResponse<{ user: AuthUser }>>('/user')
      updateUser(response.data.user)
    } catch {
      // Stale or invalid token
      updateAuthToken(null)
      updateUser(null)
    }
  }

  const logoutAction = async () => {
    if (!authToken.value) return
    try {
      const api = useApi()
      await api('/logout')
    } catch {
      // Log out locally even if the token is already invalid
    }

    localStorage.clear()
    updateAuthToken(null)
    updateUser(null)

    await navigateTo('/')
  }

  return { user, updateUser, isLoggedIn, authToken, updateAuthToken, fetchUser, logoutAction }
})
```

### Explanation

- **`navigateTo('/')` instead of importing the router.** In Nuxt the router is created by
  the framework. Importing a router module into a store isn't possible (there is none) and
  was a circular dependency anyway (router → store → router). `navigateTo` works in
  components, stores, middleware and plugins.
- **`setItem(AUTH_TOKEN, null)` bug fixed.** `localStorage.setItem(k, null)` stores the
  *string* `"null"`, which is truthy, so after a reload the app thought it was logged in.
  We `removeItem` instead.
- **Logout always clears locally.** The original swallowed errors, so with an expired
  token the user could never log out.
- **`fetchUser` handles stale tokens** instead of leaving the app half-booted.
- **`localStorage` at store creation is only safe because `ssr: false`.** With SSR, this
  line would throw `localStorage is not defined` on the server. The SSR-safe version uses
  `useCookie('auth_token')`.
- `@pinia/nuxt` auto-imports `defineStore`. The explicit import is kept for clarity.

---

## 11. Step 8 — Routing: `vue-router` config → file-based pages

### Before

```js
// router/index.js
const routes = [
    { path: '/invite/:code', name: 'invite.register', component: () => import('@/views/InviteRegister.vue'), meta: { requireUnauth: true } },
    { path: '/', name: 'login', component: () => import('@/views/Login.vue'), meta: { requireUnauth: true } },
    ...adminRoute,
    ...superadminRoute,
]
export const router = createRouter({ history: createWebHistory(), routes })
```

```js
// router/superadmin.js
{ path: "/superadmin/dashboard",     name: "superadmin.dashboard",   component: ..., meta: { requireAuth: true, allowedUserType: ['superadmin'] } },
{ path: "/superadmin/urls/:client_id", name: "superadmin.urls.client", component: ..., meta: { ... } },
{ path: "/superadmin/urls",          name: "superadmin.urls",        component: ..., meta: { ... } },
```

### After — the file system *is* the route table

| File | URL | Auto route name |
|---|---|---|
| `pages/index.vue` | `/` | `index` |
| `pages/invite/[code].vue` | `/invite/:code` | `invite-code` |
| `pages/admin/dashboard.vue` | `/admin/dashboard` | `admin-dashboard` |
| `pages/admin/team-members.vue` | `/admin/team-members` | `admin-team-members` |
| `pages/superadmin/dashboard.vue` | `/superadmin/dashboard` | `superadmin-dashboard` |
| `pages/superadmin/urls/index.vue` | `/superadmin/urls` | `superadmin-urls` |
| `pages/superadmin/urls/[client_id].vue` | `/superadmin/urls/:client_id` | `superadmin-urls-client_id` |

Route **meta moves into each page** with `definePageMeta`:

```vue
<!-- app/pages/superadmin/dashboard.vue -->
<template>
    <SuperadminClients />
</template>

<script setup lang="ts">
definePageMeta({
    requireAuth: true,
    allowedUserType: ["superadmin"],
});
</script>
```

```vue
<!-- app/pages/superadmin/urls/index.vue -->
<template>
    <SuperadminShortUrls />
</template>

<script setup lang="ts">
definePageMeta({ requireAuth: true, allowedUserType: ["superadmin"] });
</script>
```

```vue
<!-- app/pages/superadmin/urls/[client_id].vue -->
<template>
    <SuperadminShortUrls :client-id="(route.params.client_id as string)" />
</template>

<script setup lang="ts">
definePageMeta({ requireAuth: true, allowedUserType: ["superadmin"] });

const route = useRoute();
</script>
```

```vue
<!-- app/pages/admin/dashboard.vue -->
<template>
    <AdminShortUrls />
</template>

<script setup lang="ts">
definePageMeta({ requireAuth: true, allowedUserType: ["admin", "member"] });
</script>
```

### Routing syntax cheat-sheet

| File name | Route |
|---|---|
| `index.vue` | folder root |
| `[id].vue` | required param `:id` |
| `[[id]].vue` | optional param |
| `[...slug].vue` | catch-all (e.g. a custom 404) |
| `users/[id]/edit.vue` | nested segments |
| `users.vue` + `users/` folder | nested (child) routes; parent renders `<NuxtPage/>` |
| `(group)/page.vue` | route group: folder name is not in the URL |

### Explanation

- **Named routes → paths.** The original used names like `superadmin.urls.client`.
  Nuxt generates names automatically (`superadmin-urls-client_id`), which are awkward and
  change when files move, so the migration navigates **by path**:
  `navigateTo('/superadmin/urls/' + id)` or `<NuxtLink :to="...">`.
- **`definePageMeta` is a compiler macro.** It is hoisted out of the component at build
  time, so it **cannot reference variables from `<script setup>`** (only imports and
  literals).
- **One component, two routes.** `/superadmin/urls` and `/superadmin/urls/:client_id` both
  render `SuperadminShortUrls`; the dynamic page passes `clientId` as a prop. A prop is
  easier to test than a component that reads `useRoute()` directly.

---

## 12. Step 9 — Navigation guards → route middleware

### Before

```js
router.beforeEach((to, from, next) => {
    const authStore = useAuthStore();

    if (to.meta && to.meta.requireAuth && !authStore.isLoggedIn) {
        return next({ name: 'login' });
    } else if (to.name === 'login' && authStore.isLoggedIn) {
        const redirectUrl = authStore.user?.type === "superadmin" ? "superadmin.dashboard" : "admin.dashboard";
        return next({ name: redirectUrl });
    } else if (to.meta?.allowedUserType && authStore.user) {
        if (!to.meta.allowedUserType.includes(authStore.user.type)) {
            const redirectUrl = authStore.user.type === "superadmin" ? "superadmin.dashboard" : "admin.dashboard";
            return next({ name: redirectUrl });
        }
    }
    next();
});
```

### After

```ts
// app/middleware/auth.global.ts
import { useAuthStore } from '~/stores/auth'
import { homeRouteFor, type UserType } from '~/utils/homeRoute'

declare module '#app' {
  interface PageMeta {
    requireAuth?: boolean
    requireUnauth?: boolean
    allowedUserType?: UserType[]
  }
}

export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()

  if (to.meta.requireAuth && !authStore.isLoggedIn) {
    return navigateTo('/')
  }

  if (to.path === '/' && authStore.isLoggedIn) {
    return navigateTo(homeRouteFor(authStore.user))
  }

  const allowedTypes = to.meta.allowedUserType
  if (allowedTypes && authStore.user && !allowedTypes.includes(authStore.user.type)) {
    return navigateTo(homeRouteFor(authStore.user))
  }
})
```

### Explanation

| `beforeEach` | Nuxt middleware |
|---|---|
| `next()` | `return` nothing |
| `next({ name })` | `return navigateTo(path)` |
| `next(false)` | `return abortNavigation()` |
| throw error page | `return abortNavigation(createError({ statusCode: 403 }))` |

- The **`.global`** suffix runs it on every route change, like `beforeEach`.
- **Typed meta:** augmenting `PageMeta` in `#app` makes `definePageMeta({ requireAuth })`
  and `to.meta.allowedUserType` type-checked.
- Three kinds of middleware:
  1. **Global:** `middleware/name.global.ts`, runs everywhere.
  2. **Named:** `middleware/auth.ts`, opted in with `definePageMeta({ middleware: 'auth' })`.
  3. **Inline:** `definePageMeta({ middleware: [(to) => { ... }] })`.
- An alternative design: create a named `auth` middleware and list it in each protected
  page instead of using a `requireAuth` flag. We kept the flag to stay close to the
  original meta.
- Ordering: global middleware runs in alphabetical order of file name, then named/inline
  middleware for the page.

---

## 13. Step 10 — Components and pages

### Mechanical changes applied to every SFC

| Vue code | Nuxt code | Why |
|---|---|---|
| `import { ref, onMounted, watch } from "vue"` | *(removed)* | Vue APIs are auto-imported |
| `import Invite from "./Invite.vue"` | *(removed)* | Components auto-imported by path name |
| `import apiAdmin from "@/composable/apiAdmin"` | `useApiRequest()` | Composables auto-imported |
| `import { useRouter } ...; router.push({ name })` | `navigateTo('/path')` | Works anywhere, SSR-safe |
| `$router.push({ name: 'x', params })` in a button | `<NuxtLink :to="...">` | Real `<a>` tag: middle-click, prefetch, accessibility |
| `<script setup>` | `<script setup lang="ts">` | Type safety |
| `:help="... : null"` | `:help="... : undefined"` | Antd props are typed `string \| undefined` |
| `createVNode(Icon)` | `h(Icon)` | `h` is auto-imported and the idiomatic helper |
| multi-root `<template>` | wrapped in one `<div>`/`<span>` | Required by Nuxt pages/transitions, see [Pitfalls](#15-pitfalls-hit-during-this-migration) |
| separate `fields.js` | `columns` const in the component | Only used in one place |

### 13.1 Login — `views/Login.vue` → `pages/index.vue`

Template unchanged except `null` → `undefined`. Script:

```vue
<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";
import { homeRouteFor } from "~/utils/homeRoute";

definePageMeta({
    layout: "blank",          // no header on the login screen
    requireUnauth: true,
});

const authStore = useAuthStore();
const { loading, rules, apiRequest } = useApiRequest();
const formData = ref({ email: "", password: "" });

const onSubmit = () => {
    apiRequest({
        url: "login",
        data: formData.value,
        success: (res) => {
            const user = res.data.user;
            authStore.updateAuthToken(res.data.token);
            authStore.updateUser(user);

            navigateTo(homeRouteFor(user));
        },
    });
};
</script>
```

Removed: `useRouter`, the duplicate `rules.value = {}; loading.value = true;` (the
composable already does it), and the inline role ternary.

### 13.2 Invite registration — `views/InviteRegister.vue` → `pages/invite/[code].vue`

```vue
<script setup lang="ts">
definePageMeta({ layout: "blank", requireUnauth: true });

const route = useRoute();
const { loading, rules, apiRequest } = useApiRequest();
const pageLoading = ref(true);

const formData = ref({ email: "", name: "", company_name: "", password: "", password_confirmation: "" });

const inviteCode = route.params.code as string;   // from [code].vue

const company = ref<{ id?: number; name?: string; is_global?: number }>({});
const invitationMessageType = ref<"warning" | "success">("warning");
const invitationMessage = ref("");

onMounted(() => {
    apiRequest({
        url: `invitation/${inviteCode}`,
        success: (res) => {
            const response = res.data.data;
            company.value = response.company;
            formData.value = { ...formData.value, name: response.name, email: response.email };
            pageLoading.value = false;
        },
        error: (err) => {
            invitationMessage.value = err.data?.message || "Invitation code not exists.";
            pageLoading.value = false;
        },
    });
});

const onSubmit = () => {
    apiRequest({
        url: `invitation/${inviteCode}/register`,
        data: formData.value,
        success: (res) => {
            invitationMessageType.value = "success";
            invitationMessage.value = res.message;
        },
    });
};
</script>
```

Template change: `@click="$router.push({ name: 'login' })"` → `@click="navigateTo('/')"`.
The `if (inviteCode) … else` branch was dropped because `[code].vue` only matches
when a code is present.

> **Shell gotcha:** `[code].vue` contains glob characters. In zsh,
> `cat > pages/invite/[code].vue` fails with *no matches found*. Quote the path:
> `"pages/invite/[code].vue"`.

### 13.3 Layout menus and logout

```vue
<!-- app/components/layout/AdminMenus.vue -->
<template>
    <span>
        <a-button type="link" @click="navigateTo('/admin/dashboard')">Dashboard</a-button>
        <a-button v-if="authStore.user?.type === 'admin'" type="link" @click="navigateTo('/admin/team-members')">
            Team Members
        </a-button>
    </span>
</template>

<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";
const authStore = useAuthStore();
</script>
```

```vue
<!-- app/components/layout/SuperadminMenus.vue -->
<template>
    <span>
        <a-button type="link" @click="navigateTo('/superadmin/dashboard')">Dashboard</a-button>
        <a-button type="link" @click="navigateTo('/superadmin/urls')">Short URLs</a-button>
    </span>
</template>
```

```vue
<!-- app/components/layout/Logout.vue -->
<template>
    <a-button type="link" @click="logout">Logout</a-button>
</template>

<script setup lang="ts">
import { ExclamationCircleOutlined } from "@ant-design/icons-vue";
import { Modal } from "ant-design-vue";
import { useAuthStore } from "~/stores/auth";

const authStore = useAuthStore();

const logout = () => {
    Modal.confirm({
        title: "Logout?",
        icon: h(ExclamationCircleOutlined),
        content: "Are you sure you want to logout?",
        onOk() {
            return authStore.logoutAction();   // returning the promise keeps OK spinning
        },
    });
};
</script>
```

Fixed typo: "Dahboard" → "Dashboard". `navigateTo` can be called straight from the
template because auto-imports are available in templates too.

### 13.4 Superadmin clients — `clients/index.vue` + `fields.js` → `components/superadmin/Clients.vue`

```vue
<template>
    <div>
        <a-page-header style="padding: 25px 0px" title="Clients">
            <template #extra>
                <SuperadminClientInvite />
            </template>
        </a-page-header>

        <a-table :columns="columns" :data-source="data" :pagination="tablePagination"
                 :loading="loading" row-key="id" @change="handleTableChange" size="middle">
            <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'name'">
                    <NuxtLink :to="`/superadmin/urls/${record.id}`">{{ record.name }}</NuxtLink>
                    <br />
                    {{ record.email }}
                </template>
            </template>
        </a-table>
    </div>
</template>

<script setup lang="ts">
const columns = [
    { title: "Client name", dataIndex: "name" },
    { title: "Users", dataIndex: "total_users" },
    { title: "Total Generated URLs", dataIndex: "total_urls" },
    { title: "Total URL Hits", dataIndex: "total_url_hits" },
];

const { url, data, loading, tablePagination, fetchData, handleTableChange } = useDatatable();

onMounted(() => {
    url.value = "superadmin/clients";
    fetchData();
});
</script>
```

Changes: the `<a-button type="link" @click="$router.push(...)">` became `<NuxtLink>`;
`row-key="id"` added (Antd warns without a unique key); `:loading` wired up.

### 13.5 Superadmin short URLs — `urls/index.vue` → `components/superadmin/ShortUrls.vue`

```vue
<template>
    <div>
        <a-page-header style="padding: 25px 0px" title="Short URLs">
            <template #extra>
                <a-range-picker :presets="rangePresets" value-format="YYYY-MM-DD" @change="onRangeChange" />
                <a-button type="primary" :loading="downloading"
                          @click="download('superadmin/urls/download', { ...params }, 'urls.csv')">
                    Download
                </a-button>
            </template>
        </a-page-header>

        <a-table :columns="columns" :data-source="data" :pagination="tablePagination"
                 :loading="loading" row-key="id" @change="handleTableChange" size="middle">
            <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'short_url'">
                    <a :href="record.short_url" target="_blank">{{ record.short_url }}</a>
                </template>
                <template v-if="column.dataIndex === 'created_at'">
                    {{ dayjs(record.created_at).format("DD MMM YYYY") }}
                </template>
                <template v-if="column.dataIndex === 'client'">
                    <NuxtLink :to="`/superadmin/urls/${record.client_id}`">{{ record.client }}</NuxtLink>
                </template>
            </template>
        </a-table>
    </div>
</template>

<script setup lang="ts">
import dayjs from "dayjs";

const props = defineProps<{ clientId?: string }>();

const columns = [
    { title: "Short URL", dataIndex: "short_url" },
    { title: "Long URL", dataIndex: "url" },
    { title: "Hits", dataIndex: "hits" },
    { title: "Client", dataIndex: "client" },
    { title: "Created On", dataIndex: "created_at" },
];
const rangePresets = useRangePresets();
const { downloading, download } = useDownload();
const { url, data, params, loading, tablePagination, reload, handleTableChange } = useDatatable();

const loadData = () => {
    if (props.clientId) {
        params.value.company_id = props.clientId;
    } else {
        delete params.value.company_id;
    }
    url.value = "superadmin/urls";
    reload();
};

onMounted(loadData);
watch(() => props.clientId, loadData);

const onRangeChange = (dates: [string, string] | null) => {
    if (dates) {
        params.value.start_date = dates[0];
        params.value.end_date = dates[1];
    } else {
        delete params.value.start_date;
        delete params.value.end_date;
    }
    reload();
};
</script>
```

Changes:
- `route.params.client_id` → `clientId` **prop**; the `watch` now watches the prop.
- About 35 lines of download code → `useDownload()`.
- `value-format="YYYY-MM-DD"` makes the picker emit strings directly, so
  `onRangeChange(dates, dateStrings)` became `onRangeChange(dates)`.
- Short URLs render as clickable links.

### 13.6 Admin short URLs — `admin/urls/index.vue` → `components/admin/ShortUrls.vue`

Same shape as 13.5, with `User` instead of `Client` column, endpoint `admin/urls`, and the
generate button in `#subTitle`:

```vue
<template #subTitle>
    <AdminGenerateUrl @success="reload" />
</template>
```

Removed dead code: the original had a `client` cell linking to the **superadmin**
route, but the admin table has no `client` column, so it never rendered. The
`route.params.client_id` handling was also dead (the admin route has no such param).

### 13.7 Modals — `GenerateUrl.vue`, `Invite.vue` (×2)

Scripts become:

```ts
// components/admin/GenerateUrl.vue
import { message } from "ant-design-vue";

const emit = defineEmits(["success"]);
const { loading, rules, apiRequest } = useApiRequest();
const formData = ref({ url: "" });
const open = ref(false);
const showModal = () => { open.value = true; };

const onSubmit = () => {
    apiRequest({
        url: "admin/urls/generate",
        data: formData.value,
        success: (res) => {
            open.value = false;
            formData.value = { url: "" };
            emit("success");
            message.success(res.message);
        },
    });
};
```

`ClientInvite.vue` (`superadmin/clients/invite`) and `TeamMemberInvite.vue`
(`admin/team-members/invite`, with `role`) follow the same pattern. The team member form's
placeholders said "Client Name" / "Enter Client Email" (copy-paste); they were fixed.

### 13.8 Team members — `team-members/index.vue` → `pages/admin/team-members.vue`

```vue
<template>
    <div>
        <a-page-header style="padding: 25px 0px" title="Team Members">
            <template #extra><AdminTeamMemberInvite /></template>
        </a-page-header>
        <a-table :columns="columns" :data-source="data" :pagination="tablePagination"
                 :loading="loading" row-key="id" @change="handleTableChange" size="middle">
            <template #bodyCell="{ column, record }">
                <template v-if="column.dataIndex === 'role'">
                    {{ record.type === "admin" ? "Admin" : "Member" }}
                </template>
            </template>
        </a-table>
    </div>
</template>

<script setup lang="ts">
definePageMeta({ requireAuth: true, allowedUserType: ["admin"] });

const columns = [
    { title: "Name", dataIndex: "name" },
    { title: "Email", dataIndex: "email" },
    { title: "Role", dataIndex: "role" },
    { title: "Total Generated URLs", dataIndex: "total_urls" },
    { title: "Total URL Hits", dataIndex: "total_url_hits" },
];

const { url, data, loading, tablePagination, fetchData, handleTableChange } = useDatatable();

onMounted(() => {
    url.value = "admin/team-members";
    fetchData();
});
</script>
```

Fixed: the page title said "Clients".

### Component auto-import naming

| File | Tag |
|---|---|
| `components/layout/Logout.vue` | `<LayoutLogout />` |
| `components/admin/GenerateUrl.vue` | `<AdminGenerateUrl />` |
| `components/superadmin/ShortUrls.vue` | `<SuperadminShortUrls />` |
| any of the above | `<LazyAdminGenerateUrl />` (code-split, loaded on first render) |

---

## 14. Step 11 — Backend changes needed for a separate frontend

Moving the UI out of Laravel means the backend must:

1. **Stop serving the SPA**

   ```php
   // routes/web.php
   Route::get('/s/{code}', [ShortUrlRedirectController::class, 'redirect'])->name('short.redirect');

   // The UI lives in the Nuxt frontend; send browser visits there
   Route::get('/', function () {
       return redirect(config('app.frontend_url'));
   });
   ```

   The old catch-all `Route::get('{path}', fn() => view('app'))->where(...)` and
   `app.blade.php` are removed.

2. **Know where the frontend is** (`config/app.php` + `.env`)

   ```php
   'frontend_url' => env('FRONTEND_URL', 'http://localhost:3000'),
   ```

3. **Build invite links to the frontend** (both invite controllers)

   ```php
   // before: route('app', '/invite/' . $inviteCode)   — that route no longer exists
   $inviteUrl = rtrim(config('app.frontend_url'), '/') . '/invite/' . $inviteCode;
   ```

4. **Allow CORS** (`php artisan config:publish cors`)

   ```php
   'allowed_origins' => explode(',', env('CORS_ALLOWED_ORIGINS', env('FRONTEND_URL', 'http://localhost:3000'))),
   'exposed_headers' => ['Content-Disposition'],
   ```

   With bearer tokens (not cookies), `supports_credentials` can stay `false`, so no Sanctum
   stateful-domain or CSRF-cookie setup is needed.

5. **Bug fix found while testing on SQLite:** `->orderBy('created_at')` on a query joining
   `short_urls`, `users` and `companies` is ambiguous. MySQL tolerates it because it
   resolves `ORDER BY` against the select list first; SQLite and PostgreSQL error out.
   Fixed with `->orderBy('short_urls.created_at', 'desc')`.

---

## 15. Pitfalls hit during this migration

| Symptom | Cause | Fix |
|---|---|---|
| **Blank page** after logging in (works after a refresh) | Page/component had **multiple root nodes**. When navigating client-side between pages with **different layouts** (`blank` → `default`), Nuxt's transition wrapper cannot handle a fragment root | Wrap each page's template (and components used as the whole page) in one root element |
| `vue-tsc` crash `ERR_PACKAGE_PATH_NOT_EXPORTED` | TypeScript 7 removed `lib/tsc` | `npm i -D typescript@^5` |
| `localStorage is not defined` | Browser API used during SSR | `ssr: false`, `.client.ts` plugin, `onMounted`, `import.meta.client` guard, or `useCookie` |
| `zsh: no matches found: pages/invite/[code].vue` | Shell glob | Quote the path |
| `:help="... : null"` type error | Antd props expect `string \| undefined` | Use `undefined` |
| Nav guards see `user === null` on refresh | User loaded after the first navigation | Load it in an async plugin (plugins finish before initial middleware) |
| Large-chunk warning on build | `app.use(Antd)` registers everything | `@ant-design-vue/nuxt` module or `unplugin-vue-components` for tree-shaking |

---

## 16. Nuxt built-in components

### Used in this project

| Component | Where | Purpose |
|---|---|---|
| `<NuxtLayout>` | `app.vue` | Renders the layout chosen by the page (`default` if none). Accepts `name` to force one |
| `<NuxtPage>` | `app.vue` | Renders the matched page; wraps `<RouterView>` with `<Suspense>`, transitions, keepalive. Use it inside parent pages for nested routes |
| `<NuxtLink>` | client/URL tables | Smart `<a>`: client-side navigation for internal links, normal `<a>` for external ones, **prefetches** linked page code when visible, `activeClass`/`exactActiveClass` |
| `<slot />` | layouts | Where the page renders inside a layout |

### Other built-ins worth knowing (interview favourites)

| Component | Purpose |
|---|---|
| `<ClientOnly>` | Renders its slot only in the browser (with a `#fallback` slot for SSR). For widgets that touch `window` |
| `<NuxtLoadingIndicator>` | Progress bar on top during page navigation |
| `<NuxtErrorBoundary>` | Catches errors in a subtree with an `#error` slot (`error`, `clearError`) |
| `<NuxtRouteAnnouncer>` | Announces page titles to screen readers on navigation (a11y) |
| `<NuxtImg>` / `<NuxtPicture>` | From `@nuxt/image`: optimized, responsive images |
| `<NuxtWelcome>` | Starter welcome screen in new projects |
| `<NuxtIsland>` / `.server.vue` | Server components: rendered on the server, no client JS |
| `<Teleport>` (Vue) | Move markup to `body`, e.g. modals |
| `<NuxtTime>` | Locale-aware, hydration-safe time display (newer Nuxt versions) |

### Core composables and helpers used

| API | Used for |
|---|---|
| `defineNuxtConfig` | Project configuration |
| `defineNuxtPlugin` | Antd registration, auth bootstrap |
| `defineNuxtRouteMiddleware` | Auth/role guard |
| `definePageMeta` | `layout`, `requireAuth`, `allowedUserType` |
| `navigateTo` | Programmatic navigation and redirects |
| `useRoute` | Reading `params.code`, `params.client_id` |
| `useRuntimeConfig` | Reading `apiBase` |
| `$fetch` / `$fetch.create` | HTTP |
| `h` (Vue, auto-imported) | Icon vnode for `Modal.confirm` |

Others to know: `useFetch`, `useAsyncData`, `useLazyFetch`, `useState`, `useCookie`,
`useHead`, `useSeoMeta`, `useNuxtApp`, `useRouter`, `useError`, `createError`,
`showError`, `clearError`, `abortNavigation`, `refreshNuxtData`, `useRequestHeaders`,
`useRequestEvent`, `callOnce`, `onNuxtReady`, `definePayloadPlugin`.

---

## 17. Nuxt concepts reference

### 17.1 Directory conventions (Nuxt 4)

| Directory | Meaning |
|---|---|
| `app/pages/` | File-based routes |
| `app/layouts/` | Layout wrappers |
| `app/components/` | Auto-imported components |
| `app/composables/` | Auto-imported composables (top-level files) |
| `app/utils/` | Auto-imported helpers |
| `app/plugins/` | Run at app start (ordered by file name) |
| `app/middleware/` | Route middleware |
| `app/stores/` | Pinia stores (auto-imported by `@pinia/nuxt`) |
| `app/assets/` | Processed by the bundler |
| `app/app.vue`, `app/error.vue` | Root component, global error page |
| `public/` | Served as-is at `/` |
| `server/api/`, `server/routes/`, `server/middleware/` | Nitro server endpoints |
| `shared/` | Code shared between app and server (Nuxt 4) |
| `.nuxt/`, `.output/` | Generated dev types / production build |

### 17.2 Rendering modes

| Mode | How | Use |
|---|---|---|
| **SSR (universal)** — default | Server renders HTML, client **hydrates** | SEO, fast first paint |
| **CSR / SPA** | `ssr: false` | Dashboards behind login (**this project**) |
| **SSG / prerender** | `nuxt generate` or `routeRules: { '/': { prerender: true } }` | Static sites, docs |
| **Hybrid** | `routeRules` per path: `prerender`, `swr`, `isr`, `ssr: false`, `redirect`, `headers`, `cors` | Mix and match |
| **Edge** | Nitro presets (Cloudflare, Vercel, Netlify…) | Low latency |

```ts
routeRules: {
  '/':          { prerender: true },
  '/blog/**':   { isr: 3600 },
  '/admin/**':  { ssr: false },
  '/old':       { redirect: '/new' },
}
```

### 17.3 Hydration

SSR sends HTML plus a serialized **payload** (state from `useAsyncData`/`useState`). The
client builds the same virtual DOM and *attaches* to the existing HTML instead of
re-rendering. If server and client render differently (e.g. `Date.now()`,
`localStorage`, random values), you get a **hydration mismatch** warning.

### 17.4 Data fetching

| API | When |
|---|---|
| `$fetch(url)` | Event handlers, plugins, server code. No SSR deduplication |
| `useFetch(url, opts)` | Data needed to render a page/component. Runs on the server, ships result in the payload, **does not refetch** on the client; reactive, returns `{ data, status, error, refresh }` |
| `useAsyncData(key, fn)` | Like `useFetch` but with any async function (SDKs, multiple calls) |
| `useLazyFetch` / `{ lazy: true }` | Don't block navigation; show loading state |
| `{ server: false }` | Fetch only on the client |
| `refreshNuxtData(key)` / `refresh()` | Re-run |

If this project enabled SSR, the URL list could become:

```ts
const { data, status, refresh } = await useFetch('/admin/urls', {
  baseURL: useRuntimeConfig().public.apiBase,
  method: 'POST',
  body: computed(() => ({ page: page.value, per_page: 10, ...filters.value })),
  watch: [page, filters],
})
```

### 17.5 State

- `ref()` in a component: local state.
- **`useState('key', () => init)`**: SSR-safe shared state, serialized in the payload.
  **Never** use a module-level `const state = ref()` with SSR: it is shared across all
  users' requests on the server (cross-request state pollution).
- **Pinia**: structured global state; `@pinia/nuxt` handles SSR hydration.

### 17.6 Auto-imports

Nuxt scans `components/`, `composables/`, `utils/` and its own APIs and generates type
declarations in `.nuxt/`. Imports are added at build time (tree-shaken, no runtime cost).
Disable with `imports: { autoImport: false }`, or import explicitly from `#imports`.

### 17.7 Runtime config vs app config

| | `runtimeConfig` | `app.config.ts` |
|---|---|---|
| Changes by env var at runtime | Yes (`NUXT_*`) | No (build time) |
| Secrets allowed | Yes (non-`public` keys stay on server) | No |
| Typical use | API URLs, keys | Theme, feature flags baked into the build |

### 17.8 Nitro

Nuxt's server engine. Gives `server/api/*.ts` endpoints (`defineEventHandler`), server
middleware, caching, storage, and deploy **presets** that output Node, serverless or edge
builds. `nuxt build` → `.output/server/index.mjs`.

### 17.9 Error handling

- `throw createError({ statusCode: 404, statusMessage: 'Not found' })` in pages/middleware.
- `showError()` / `clearError({ redirect: '/' })`.
- `app/error.vue` renders full-page errors.
- `<NuxtErrorBoundary>` for local errors.

### 17.10 SEO / head

```ts
useHead({ title: 'Short URLs', meta: [{ name: 'robots', content: 'noindex' }] })
useSeoMeta({ title: 'Short URLs', ogTitle: 'Short URLs', description: '...' })
```

---

## 18. Interview questions and answers

### Basics

**1. What is Nuxt and how is it different from Vue?**
Vue is a UI library. Nuxt is a framework built on Vue, Vite, vue-router and Nitro.
It adds file-based routing, layouts, auto-imports, server-side rendering, static
generation, a server engine for API routes, and deploy targets, all set up by
convention instead of manual wiring.

**2. What's new in Nuxt 4 compared to Nuxt 3?**
The default `srcDir` is `app/` (cleaner separation of client, `server/` and `shared/`),
changes to data-fetching defaults (e.g. shared `data` refs per key, `undefined` instead of
`null` defaults), separate TypeScript projects for app/server/shared, and various
performance improvements. Migration is mostly mechanical; the
`compatibilityDate` option pins behaviour.

**3. Explain the rendering modes Nuxt supports.**
SSR (default, hydrated universal rendering), CSR (`ssr: false`), SSG (`nuxt generate`
or prerender route rules), hybrid per-route rendering via `routeRules`
(prerender/ISR/SWR/SPA per path), and edge rendering through Nitro presets.

**4. Why did this project use `ssr: false`?**
Auth tokens live in `localStorage`, which the server can't read, and it's a dashboard
behind a login, so SEO doesn't matter. SSR would render pages logged-out and then
redirect. To use SSR, move the token to a cookie (`useCookie`) so the server can send it to the API.

**5. What is hydration and what causes hydration mismatches?**
The client attaches Vue's reactivity to server-rendered HTML instead of re-rendering.
Mismatches happen when the server and client produce different markup: time/random values,
browser-only APIs, invalid HTML nesting (`<div>` inside `<p>`), or conditional rendering on
`window`. Fix by making output deterministic, deferring to `onMounted`, or wrapping the
part in `<ClientOnly>`.

### Routing and navigation

**6. How does file-based routing work? How do you create dynamic and catch-all routes?**
Each `.vue` file in `pages/` becomes a route. `[id].vue` is a param, `[[id]].vue` an
optional param, `[...slug].vue` a catch-all, `index.vue` the folder root. A file next to a
same-named folder (`users.vue` + `users/`) creates nested routes rendered via `<NuxtPage>`.

**7. What is `definePageMeta` and what are its limitations?**
A compiler macro that attaches route metadata (layout, middleware, custom keys, `key`,
`keepalive`, `pageTransition`, `alias`, `name`, `path`) to a page. Because it is hoisted
out of the component at build time, it can't reference local variables from
`<script setup>`.

**8. `navigateTo` vs `router.push`?**
`navigateTo` is Nuxt's helper. It works in components, middleware, plugins and server
context; it performs a server redirect during SSR; it supports `external: true`,
`replace`, `redirectCode` and `open` (new window). In middleware you must **return** it.
`router.push` is client-only vue-router.

**9. Name the three kinds of route middleware.**
Global (`*.global.ts`, runs on every navigation), named (`middleware/auth.ts`, opted in via
`definePageMeta({ middleware: 'auth' })`), and inline (a function in `definePageMeta`).
Return `navigateTo()` to redirect, `abortNavigation()` to stop, or nothing to continue.

**10. Route middleware vs server middleware?**
Route middleware (`app/middleware/`) runs in the Vue app during navigation. Server
middleware (`server/middleware/`) runs in Nitro on **every HTTP request**, before
API/page handlers (logging, headers, auth on server routes).

**11. Why `<NuxtLink>` instead of `<a>` or a button with `router.push`?**
It does client-side navigation for internal routes, falls back to a normal `<a>` for
external links, prefetches the target page's JS when the link is in view, and keeps
native link behaviour (middle-click, copy link, accessibility, SEO crawlability).

### Data, state and config

**12. `$fetch` vs `useFetch` vs `useAsyncData`?**
`$fetch` is a plain HTTP client (ofetch). `useFetch` = `useAsyncData` + `$fetch`: it runs
during SSR, stores the result in the payload so the client doesn't refetch, dedupes by key,
and returns reactive `data`, `status`, `error`, `refresh`. `useAsyncData` takes any async
function. Use the composables for render data in setup; use `$fetch` in event handlers.

**13. What happens if you call `$fetch` directly in `<script setup>` of an SSR page?**
It runs twice: once on the server, then again on the client during hydration, because
nothing transfers the result. `useFetch`/`useAsyncData` avoid this via the payload.

**14. What is `useState` and why not a global `ref`?**
`useState(key, init)` creates SSR-safe shared state that is serialized to the client. A
module-level `ref` lives in the server process and is shared across all users' requests,
leaking data between them.

**15. How do you use Pinia in Nuxt?**
Add `@pinia/nuxt` to `modules`. Stores in `stores/` are auto-imported along with
`defineStore`/`storeToRefs`. State is serialized for hydration automatically. Avoid
browser APIs during store setup when SSR is on.

**16. `runtimeConfig` vs `app.config` vs `.env`?**
`runtimeConfig` holds values that can change per environment at **runtime** via `NUXT_*`
env vars; `public` keys reach the client, others are server-only (secrets). `app.config.ts`
is for public build-time config (theme, flags). `.env` is only read in dev/build; in
production you set real environment variables.

**17. How would you pass an auth token to API calls in Nuxt?**
Create a `$fetch.create()` instance (in a composable or plugin) with an `onRequest` hook
that adds `Authorization`. Read the token from `useCookie` (SSR-friendly) or
`localStorage` (client only). Handle 401 in `onResponseError`. This project's `useApi()`
does exactly this.

### Plugins, modules, components

**18. Plugin vs module?**
A **plugin** runs at app runtime (register Vue plugins, provide helpers, init state).
A **module** runs at **build time** to extend Nuxt itself: add plugins, components,
config, auto-imports (e.g. `@pinia/nuxt`, `@nuxt/image`).

**19. How do you control plugin order and environment?**
File-name order (prefix `01.`, `02.`), or `enforce: 'pre' | 'post'`, `dependsOn`, and
`parallel`. Suffix `.client.ts` / `.server.ts` restricts where it runs.

**20. Does Nuxt wait for async plugins?**
Yes, by default it awaits each plugin before continuing, which is why `02.auth.ts`
can load the user before the first middleware run. `parallel: true` lets later plugins
start without waiting.

**21. How are components auto-imported and named?**
Files under `components/` are registered by path: `components/admin/GenerateUrl.vue` →
`<AdminGenerateUrl>`. Prefix `Lazy` to code-split. Only components actually used are
bundled.

**22. What does `<ClientOnly>` do?**
Renders its slot only after mounting in the browser, with an optional `#fallback` for
the server. Used for browser-only widgets (charts, maps, editors) under SSR.

**23. Why must pages have a single root element?**
`<NuxtPage>` wraps pages in `<Transition>`, which needs a single element to animate.
Multi-root (fragment) pages can render blank or warn during navigation, which is the exact
bug this migration hit when switching from the `blank` to the `default` layout.

**24. How do layouts work, and how do you change one dynamically?**
Files in `layouts/` render page content via `<slot/>`. Choose with
`definePageMeta({ layout: 'blank' })`, disable with `layout: false`, or change at runtime
with `setPageLayout('name')`. `<NuxtLayout>` in `app.vue` renders the active one.

### Server, build, deployment

**25. What is Nitro?**
Nuxt's server engine. It serves SSR, `server/api` endpoints, server middleware,
caching (`defineCachedEventHandler`), storage, and builds for many targets through
presets (Node, Vercel, Netlify, Cloudflare, AWS Lambda, static).

**26. `nuxt build` vs `nuxt generate`?**
`build` creates a server bundle (`.output/server`) for SSR/hybrid hosting.
`generate` prerenders routes to static HTML in `.output/public` for static hosting.
With `ssr: false`, `generate` produces an SPA shell plus assets; serve it with a fallback
to `index.html`.

**27. How would you protect routes in SSR mode?**
Store the token in an httpOnly cookie, read it with `useCookie` (or
`useRequestHeaders(['cookie'])` to forward it) in a global middleware, fetch the user via
`useFetch` / `callOnce` in a plugin, and redirect with `navigateTo`. Optionally proxy the
backend through `server/api` so the token never touches client JS.

**28. How do you handle errors globally?**
`createError` / `showError` to raise; `app/error.vue` for the full-page error UI;
`<NuxtErrorBoundary>` for sections; `vue:error` / `app:error` hooks for logging.

**29. How do you improve SEO in Nuxt?**
Use SSR/SSG, `useHead`/`useSeoMeta` per page, `<NuxtLink>` for crawlable links, sitemap
and robots modules, `@nuxt/image` for optimized images, and `routeRules` for caching.

**30. How do you optimize bundle size?**
Lazy components (`Lazy` prefix), tree-shakeable UI libraries (component resolvers instead
of `app.use(Antd)`), dynamic imports, `<NuxtLink>` prefetching, `nuxi analyze` to inspect
chunks, and server components for static parts.

### Vue fundamentals interviewers mix in

**31. `ref` vs `reactive`?**
`ref` wraps any value (accessed via `.value` in JS, auto-unwrapped in templates);
`reactive` makes an object deeply reactive but can't hold primitives and loses reactivity
when destructured. Most codebases (including this one) prefer `ref`.

**32. `computed` vs `watch`?**
`computed` derives a cached value from reactive sources (`isLoggedIn`). `watch` runs side
effects when sources change (`watch(() => props.clientId, loadData)`).

**33. What is a composable?**
A function using Composition API to encapsulate reusable stateful logic, conventionally
named `useX` (`useDatatable`, `useApiRequest`). Each call gets its own state unless the
state is defined outside the function.

**34. `defineProps` / `defineEmits`?**
Compiler macros in `<script setup>` to declare inputs and events, with TypeScript
inference: `defineProps<{ clientId?: string }>()`, `defineEmits(['success'])`.

**35. What is `<Suspense>` and how does Nuxt use it?**
A Vue component that waits for async setup (top-level `await`) in its children before
rendering. `<NuxtPage>` wraps pages in it, which is why pages can `await useFetch(...)` at
the top of `<script setup>`.

---

## 19. Migration checklist

- [ ] Create the Nuxt app; install UI library, Pinia (`@pinia/nuxt`), helpers
- [ ] Decide rendering mode (`ssr: false` if auth is in `localStorage`)
- [ ] Move global CSS into `css: []`
- [ ] Replace `window.config` / env injection with `runtimeConfig.public`
- [ ] Register Vue plugins in `plugins/*.ts` via `nuxtApp.vueApp.use()`
- [ ] Replace axios instances with a `$fetch.create()` composable
- [ ] Port composables to `composables/` (rename to `useX`, drop imports)
- [ ] Port the store; replace router imports with `navigateTo`
- [ ] Convert the routes array to `pages/` files; move `meta` into `definePageMeta`
- [ ] Convert layout parent routes to `layouts/` with `<slot/>`
- [ ] Convert `beforeEach` to `middleware/*.global.ts`
- [ ] Load the current user in an async plugin before the first navigation
- [ ] Replace `router.push({ name })` with `navigateTo(path)` / `<NuxtLink>`
- [ ] Ensure every page has a **single root element**
- [ ] Backend: remove SPA catch-all route, add CORS, point emailed links to the frontend
- [ ] Run `npx nuxi typecheck` and `npm run build`
- [ ] Test hard refresh on every protected route, login → dashboard, logout, and role redirects
