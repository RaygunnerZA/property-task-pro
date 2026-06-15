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
1. Member forwards PDF to org intake address → appears in Add to Filla **Pending review** within ~60s.
2. Unknown sender → appears in **Issues / Needs review**, not in member intake list.
3. Duplicate webhook delivery does not duplicate signals (check `dedupe_key`).
