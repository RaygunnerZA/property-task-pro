# CHAPTER 31 — PUBLIC SITE, DOMAINS & ORIGIN ISOLATION

STATUS: CANONICAL for public website hosting, DNS, and origin security.

This chapter does **not** change operational IA, navigation, tasks, signals, or billing
rules. Public plan *copy* on the marketing site must defer to **20_Billing.md**.

---

## 31.1 — TWO ORIGINS

| Host | Role |
|---|---|
| `www.filla.app` (apex `filla.app` redirects here) | Public marketing site |
| `app.filla.app` | Authenticated product (login, signup, workbench) |
| `inbox.filla.app` | Inbound email MX (unchanged — **15_External_Ingestion.md**) |

Do **not** serve marketing from the product SPA. Do **not** put the workbench under a
path on the marketing host.

---

## 31.2 — SECURITY RULES

1. **Separate origins.** XSS or a compromised third-party script on the marketing host
   cannot read `app.filla.app` `localStorage` or host-only cookies.
2. **Sessions stay on the app origin.** Supabase Auth persists in `localStorage` on
   `app.filla.app`. Never set `Domain=.filla.app` on auth cookies.
3. **Marketing never loads Supabase.** No anon/publishable key, no auth client, no
   `VITE_SUPABASE_*` in `marketing/`.
4. **Auth redirects never return to marketing.** Supabase Site URL and Redirect URLs
   are `https://app.filla.app` and app paths only (`/login`, `/signup`, `/verify`,
   `/auth/callback`, `/reset-password`, `/accept-invitation`).
5. **CTAs are ordinary links** to `https://app.filla.app/signup` and `/login`.
6. **Indexing.** `app.filla.app` `robots.txt` disallows crawlers. `www.filla.app` is
   the public indexable site.

---

## 31.3 — ENVIRONMENT

**Product (root Vercel project)**

* `VITE_APP_URL=https://app.filla.app`
* `VITE_MARKETING_URL=https://www.filla.app`
* Existing `VITE_SUPABASE_*` keys stay here only

**Marketing (`marketing/` Vercel project)**

* `VITE_APP_ORIGIN=https://app.filla.app`
* No Supabase variables

---

## 31.4 — DEPLOY

Two Vercel projects from this repository:

| Project | Root directory | Domain |
|---|---|---|
| Product | repository root | `app.filla.app` |
| Marketing | `marketing` | `www.filla.app` |

DNS:

* `www.filla.app` → marketing project
* Apex `filla.app` → 301 to `https://www.filla.app`
* `app.filla.app` → product project

Supabase Dashboard → Authentication → URL Configuration:

* Site URL = `https://app.filla.app`
* Redirect allowlist = app origin paths only

---

## 31.5 — SOURCE

* Marketing app: `marketing/`
* Product helpers: `getAppBaseUrl()`, `getMarketingBaseUrl()` in `src/lib/utils.ts`
