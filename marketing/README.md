# Filla marketing site

Public origin for **www.filla.app** / **filla.app**. Isolated from the authenticated product on **app.filla.app**.

This package must never import `@supabase`, app source under `../src`, or any `VITE_SUPABASE_*` keys.

## Local

```sh
cd marketing
cp .env.example .env
npm ci
npm run dev
```

Opens on port **4321**. The app (port **8080**) is the target for Sign in / Start free.

## Deploy (Vercel)

Create a **second** Vercel project:

| Setting | Value |
|---|---|
| Root directory | `marketing` |
| Build | `npm run build` |
| Output | `dist` |
| Domain | `www.filla.app` (apex `filla.app` redirects to www) |
| Env | `VITE_APP_ORIGIN=https://app.filla.app` |

Do not attach this project to `app.filla.app`.

Architecture and DNS: [`@Docs/31_Public_Site.md`](../@Docs/31_Public_Site.md).
