# Filla marketing site

Public package intended for **www.filla.app**. Isolated from the authenticated product on **filla.app** (see `@Docs/31_Public_Site.md`).

Today the product Vercel project owns apex **`filla.app`**. Attach this marketing project to **`www.filla.app`** only — do not move apex off the product without a redirect plan.

This package must never import `@supabase`, app source under `../src`, or any `VITE_SUPABASE_*` keys.

## Local

```sh
cd marketing
cp .env.example .env
npm ci
npm run dev
```

Opens on port **4321**. The app (port **8080** locally, **https://filla.app** in Production) is the target for Sign in / Start free.

## Deploy (Vercel)

Create a **second** Vercel project:

| Setting | Value |
|---|---|
| Root directory | `marketing` |
| Build | `npm run build` |
| Output | `dist` |
| Domain | `www.filla.app` |
| Env | `VITE_APP_ORIGIN=https://filla.app` |

Do not attach this project to the product’s Production domains (`filla.app`, `property-task-pro.vercel.app`).

Architecture and DNS: [`@Docs/31_Public_Site.md`](../@Docs/31_Public_Site.md).
