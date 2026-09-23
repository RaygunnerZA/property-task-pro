# Inbound email ops checklist (Phase 1)

## DNS
- Add MX record for `inbox.filla.app` pointing to Resend inbound (see Resend dashboard → Receiving).

## Resend
- Enable Inbound on the `filla.app` domain (or subdomain).
- Create webhook: `https://{project_ref}.supabase.co/functions/v1/inbound-email`
- Subscribe to `email.received`.
- Copy webhook signing secret.

## Supabase secrets
```bash
# API key MUST be Full access (re_...) — Sending-only keys return 401 on Receiving API.
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set RESEND_WEBHOOK_SECRET=whsec_...
```

In Resend → **API Keys** → create key with **Full access** (not "Sending access" only).  
Do not put `whsec_...` in `RESEND_API_KEY` — that is the webhook signing secret.

Optional OAuth (Phase 2+):
```bash
supabase secrets set GOOGLE_OAUTH_CLIENT_ID=...
supabase secrets set MICROSOFT_OAUTH_CLIENT_ID=...
```

## Deploy edge functions
```bash
supabase db push
supabase functions deploy inbound-email
supabase functions deploy intake-process
supabase functions deploy ai-doc-analyse
supabase functions deploy ai-image-analyse
supabase functions deploy oauth-connect-start
supabase functions deploy calendar-import
```

## Verify
1. Member sends or CCs their personal address from Settings → Profile → one row on Home → Needs review, with one suggested outcome.
2. The same message id delivered twice does not create a second row.
3. A From address that is not the member login is labelled External sender—not verified as you.
4. Unknown sender to the shared organisation address → Issues / Needs review, not the member intake list.
5. Replacing the address in Profile makes the previous address stop resolving.
