# CHAPTER 15 — EXTERNAL INGESTION (Share to Filla)

**15.1 — PURPOSE**
Filla acts as a gravity well. Ingest content via Share Sheet, Email, Drag & Drop, Calendar, or Cloud pickers.

**15.2 — CHANNELS**
*   **Manual upload:** Add to Filla sheet or global drop zone → `intake_items`.
*   **Email (Resend Inbound):** personal `{name}+{token}@inbox.filla.app` from `get_member_intake_email`. The shared organisation address remains for older forwards.
*   **Calendar (Phase 3):** Connected Google/Microsoft account → `intake_items` with `source_type = calendar_event`.
*   **Cloud picker (Phase 4):** Drive/OneDrive selection → `intake_items` with `source_type = cloud_file`.

**15.3 — PIPELINE SPLIT**

User-initiated intake (`intake_items`):
Uploads follow Receive → Secure attach (inbox bucket) → AI classification (`intake-process`) → **IntakeReviewSheet** → **IntakeModal** → task or compliance record → `confirmed`.
Personal inbound mail follows the membership token on the webhook envelope, then one proposal (`inbound_email_triage`) on the same review sheet. Task and record continue in **IntakeModal**. Knowledge confirm creates an organisation candidate and does not publish.

System-detected intake (`signals`):
Unknown external sender email → `emit_signal` (`kind=email`, `disposition=needs_review`, `review_state=needs_classification`) → Issues / Needs review. Managers triage; does **not** appear in the member's Add to Filla pending list.

Manager promote (Issues Action Layer):
*   **Convert to review** calls `promote_external_email_signal(signal_id)` → creates `intake_items` (`source_type=forwarded_email`, `created_by` = manager) from `payload.attachment_paths` (or a text-only row from preview), marks the signal `converted_to_record`, then runs `intake-process` and opens Home Inflow pending review.
*   **Dismiss** resolves the signal without creating intake rows.

Member email routing:
*   Personal address: the token hash resolves an active membership. Envelope recipients on the webhook (`to`, `cc`, `bcc`) are the routing source. To and Cc on the fetched message are stored for display. A From address that matches the member login is `authorship = member`. Any other From still lands in that member's Needs review, labelled **External sender—not verified as you**, with `authorship = external`.
*   One `intake_items` row per message. Body and accepted attachments are classified together into one proposal: `task` (a reminder is a task with a due date), `record`, `knowledge` (organisation scope, only with cited reusable evidence), or `unclear`. The person confirms, changes type, or dismisses on Home → Needs review. Knowledge confirm creates an organisation candidate and does not publish.
*   Shared organisation address: `From` matches an org member → `create_intake_item_from_email`. Unknown `From` → signal only (`subtype=ingestion.external_email`).

**15.4 — RESEND INBOUND (Phase 1)**

Provider: [Resend Inbound](https://resend.com/docs/dashboard/receiving/introduction).

Personal address: `{name}+{token}@inbox.filla.app` (`get_member_intake_email`). The token is stored as a hash, can be rotated, and is revoked when membership ends. Shared organisation address: `{slug}+{intake_email_token}@inbox.filla.app` (`get_org_intake_email`).

Webhook: `POST /functions/v1/inbound-email` — Svix signature via `RESEND_WEBHOOK_SECRET` (required). Event `email.received` fetches the message from the Resend Receiving API. Duplicate message ids and per-token / per-sender hourly limits are applied before AI. Attachments are size-capped, type-checked, and rejected when the bytes do not match the declared type.

Where people see the address: **Settings → Profile**, and a short copy row in **Add to Filla**.

Dedupe: `dedupe_key = email_inbound:{org_id}:{message_id}` on external signals.

**15.5 — THE INBOX (`intake_items`)**
A holding state for user-deliberate uploads and member forwards. AI suggests filing destination. **Review UI:** Home Inflow (“Uploads to review” under Needs review) — not the Add to Filla capture sheet. External unknown emails use the signals layer instead.

**15.6 — CONNECTED ACCOUNTS (Phase 2+)**
`connected_accounts` stores per-user OAuth connections (Google, Microsoft). Settings → Integrations. Calendar import and cloud pickers require an active connection; token storage is encrypted at the app layer.
