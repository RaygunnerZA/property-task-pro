# CHAPTER 31 — PUBLIC SITE, DOMAINS & ORIGIN ISOLATION

STATUS: CANONICAL for public website hosting, DNS, and origin security.

This chapter does **not** change operational IA, navigation, tasks, signals, or billing
rules. Public plan *copy* on the marketing site must defer to **20_Billing.md**.

---

## 31.1 — CURRENT PRODUCTION HOSTS

As of 2026-09, the **product** Vercel project (`property-task-pro`, repo root) serves:

| Host | Role |
|---|---|
| `filla.app` | Authenticated product (login, signup, workbench, `/admin/*`) — **primary Production domain** |
| `property-task-pro.vercel.app` | Same Production deployment (Vercel default alias) |
| `inbox.filla.app` | Inbound email MX (unchanged — **15_External_Ingestion.md**) |

`app.filla.app` is **not** configured (no DNS / not attached to Vercel). Do not document or share it as a live URL.

The marketing package lives in `marketing/` and is intended for a **separate** Vercel project on `www.filla.app`. Until that project owns `www` (and the apex redirects to www), do **not** assume apex `filla.app` is marketing — apex is currently the product.

Platform Knowledge admin (platform_admins only): `https://filla.app/admin/knowledge`  
(equivalent: `https://property-task-pro.vercel.app/admin/knowledge`)

---

## 31.2 — TARGET ORIGIN SPLIT (WHEN MARKETING IS LIVE ON WWW)

Preferred long-term layout (restore when marketing has its own domain assignment):

| Host | Role |
|---|---|
| `www.filla.app` (apex `filla.app` redirects here) | Public marketing site |
| `app.filla.app` (or keep product on a dedicated host) | Authenticated product |
| `inbox.filla.app` | Inbound email MX |

Do **not** serve marketing from the product SPA. Do **not** put the workbench under a
path on the marketing host.

Until that split is live, treat **`https://filla.app`** as the product origin for Auth, env, and CTAs.

---

## 31.3 — SECURITY RULES

1. **Separate origins when marketing is on www.** XSS or a compromised third-party script on the marketing host must not read product `localStorage` or host-only cookies.
2. **Sessions stay on the product origin.** Supabase Auth persists in `localStorage` on the product host (`filla.app` today). Never set `Domain=.filla.app` on auth cookies.
3. **Marketing never loads Supabase.** No anon/publishable key, no auth client, no
   `VITE_SUPABASE_*` in `marketing/`.
4. **Auth redirects never return to marketing.** Supabase Site URL and Redirect URLs
   are the product origin only (`https://filla.app` today) and app paths
   (`/login`, `/signup`, `/verify`, `/auth/callback`, `/reset-password`, `/accept-invitation`).
   Also allowlist the Vercel Production alias if used for login:
   `https://property-task-pro.vercel.app` and the same paths.
5. **CTAs** from marketing link to `https://filla.app/signup` and `/login` (until a dedicated `app.` host exists).
6. **Indexing.** Product `public/robots.txt` disallows crawlers. Marketing on `www` is the public indexable site when that project is attached.

---

## 31.4 — ENVIRONMENT

**Product (root Vercel project — domains: `filla.app`, `property-task-pro.vercel.app`)**

* `VITE_APP_URL=https://filla.app`
* `VITE_MARKETING_URL=https://www.filla.app` (outbound marketing links; may 404 until www is attached)
* Existing `VITE_SUPABASE_*` keys stay here only
* Never set `VITE_APP_DEV_BUILD` on Production

**Marketing (`marketing/` Vercel project — when deployed)**

* `VITE_APP_ORIGIN=https://filla.app`
* No Supabase variables

---

## 31.5 — DEPLOY

Two Vercel projects from this repository (when marketing is separate):

| Project | Root directory | Domain(s) today |
|---|---|---|
| Product | repository root | `filla.app`, `property-task-pro.vercel.app` |
| Marketing | `marketing` | `www.filla.app` (attach when ready; do **not** steal apex from product without a redirect plan) |

DNS (current):

* Apex `filla.app` → product project (Valid Configuration in Vercel)
* `property-task-pro.vercel.app` → same Production deployment
* `app.filla.app` → not in use

Supabase Dashboard → Authentication → URL Configuration:

* Site URL = `https://filla.app`
* Redirect allowlist = product origin paths (and vercel.app alias if used)

---

## 31.6 — SOURCE

* Marketing app: `marketing/`
* Product helpers: `getAppBaseUrl()`, `getMarketingBaseUrl()` in `src/lib/utils.ts`
