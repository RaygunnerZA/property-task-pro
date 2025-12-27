# CHAPTER 15 — EXTERNAL INGESTION (Share to Filla)

**15.1 — PURPOSE**
Filla acts as a gravity well. Ingest content via Share Sheet, Email, or Drag & Drop.

**15.2 — CHANNELS**
*   **Share Sheet:** iOS/Android share intent.
*   **Email:** `org+hash@inbox.filla.app`. Accepts forwards (quotes, invoices).

**15.3 — PIPELINE**
Receive → Secure Attach → Org Resolution → AI Classification → Inbox/Review.

**15.4 — THE INBOX**
A holding state for unsorted uploads. AI suggests: "This looks like a Quote for Property X."