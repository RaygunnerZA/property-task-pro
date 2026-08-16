# CHAPTER 21 — DATA LIFECYCLE & RETENTION

**21.1 — PHILOSOPHY**
Non-destructive by default. Data represents history.

**21.2 — STATES**
Active → Archived → Soft-Deleted → Hard-Deleted (Rare/Legal).

**21.4 — ORG EVENTS**
Property sale archives data but retains evidence. Org deletion offers export grace period.

**21.5 — AI EVALUATION FIXTURES**

Golden-set fixtures (`evals/fixtures`) are the one place where customer-derived material could quietly become permanent platform data, so the rules are explicit.

*   A fixture must be **synthetic** (created for this purpose, describing no real property) or **explicitly consented** — the customer agreed, in writing, that this specific document may be used for Filla platform evaluation.
*   **Community data-sharing consent (`data_sharing_level`) does not cover this.** That consent is for anonymised pattern contribution. Replaying a customer's drawing to candidate providers on every eval run is platform R&D, not delivery of the service they bought, and the document itself is not anonymised by aggregation.
*   Fixtures live in the repository, never in an org storage bucket, and never inside `property-plans` or `property-plan-pages`. They are therefore **outside org deletion and retention flows**, because they are no longer org data.
*   That exemption is exactly why the consent bar is high: org deletion will not remove them. Withdrawn consent must be honoured by removing the fixture from the repository, and the manifest records the basis for every consented fixture so this stays actionable.
*   No personal data in any fixture, synthetic or consented: no names, signatures, addresses or contact details.
*   `ai_capability_evals` stores scores and per-fixture diagnostics, not input documents.

Production-derived metrics are the safer default and should be preferred: `admin_ai_plan_extraction_metrics` reads review outcomes already recorded in the normal course of work, copying no customer document anywhere.