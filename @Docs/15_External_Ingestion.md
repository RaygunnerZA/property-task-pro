# CHAPTER 15 — EXTERNAL INGESTION (Share to Filla)

**15.1 — PURPOSE**
Filla acts as a gravity well. Ingest content via Share Sheet, Email, Drag & Drop, Calendar, or Cloud pickers.

**15.2 — CHANNELS**
*   **Manual upload:** Add to Filla sheet or global drop zone → `intake_items`.
*   **Email (Resend Inbound):** `{org_slug}+{token}@inbox.filla.app`. Accepts forwards (quotes, invoices).
*   **Calendar (Phase 3):** Connected Google/Microsoft account → `intake_items` with `source_type = calendar_event`.
*   **Cloud picker (Phase 4):** Drive/OneDrive selection → `intake_items` with `source_type = cloud_file`.

**15.3 — PIPELINE SPLIT**

User-initiated intake (`intake_items`):
Receive → Secure attach (inbox bucket) → Org resolution → AI classification (`intake-process`) → **IntakeReviewSheet** → **IntakeModal** → task or compliance record → `confirmed`.

System-detected intake (`signals`):
Unknown external sender email → `emit_signal` (`kind=email`, `disposition=needs_review`, `review_state=needs_classification`) → Issues / Needs review. Managers triage; does **not** appear in the member's Add to Filla pending list.

Member email routing:
*   `From` matches org member → `create_intake_item_from_email` (`source_type=forwarded_email`) → same review pipeline as uploads.
*   Unknown `From` → signal only (`subtype=ingestion.external_email`); attachments stored under org inbox path for triage payload.

**15.4 — RESEND INBOUND (Phase 1)**

Provider: [Resend Inbound](https://resend.com/docs/dashboard/receiving/introduction).

Address format: `{slug}+{intake_email_token}@inbox.filla.app` (from `get_org_intake_email` RPC).

Webhook: `POST /functions/v1/inbound-email` — Svix signature via `RESEND_WEBHOOK_SECRET`. Event `email.received` triggers fetch of full email + attachments from Resend Receiving API.

Dedupe: `dedupe_key = email_inbound:{org_id}:{message_id}` on external signals.

**15.5 — THE INBOX (`intake_items`)**
A holding state for user-deliberate uploads and member forwards. AI suggests filing destination. External unknown emails use the signals layer instead.

**15.6 — CONNECTED ACCOUNTS (Phase 2+)**
`connected_accounts` stores per-user OAuth connections (Google, Microsoft). Settings → Integrations. Calendar import and cloud pickers require an active connection; token storage is encrypted at the app layer.
