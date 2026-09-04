# CHAPTER 29 — KNOWLEDGE CAPABILITY

**Status:** Implementation guide (defers to constitution for schema/IA)  
**Canonical schema/RLS:** `@Docs/03_Data_Model.md`  
**Entity context:** `@Docs/Appendix_A.md` (KNOWLEDGE)  
**Assistant / critic:** `@Docs/07_AI_Intelligence.md`  
**Phase 2 build order:** `@Docs/30_Phase2_Knowledge_First.md`

---

## Purpose

Add verified Knowledge as a first-class capability without duplicating Compliance, Records, Tasks, Signals, or Messages.

Knowledge is linked into org-scoped entities via `knowledge_links`. It is **not** a property-graph node.

## Axes

| Axis | Values |
|------|--------|
| `scope` | `platform` \| `organisation` |
| `status` | `candidate` \| `verified` \| `published` \| `stale` \| `archived` |

Source kinds (provenance): `filla_curated` \| `org_upload` \| `operational_discovery` \| `community_brain`.

## Flows

```
Existing inputs (uploads, messages, compliance, tasks, docs, Filla Brain)
  → Knowledge candidates
  → Extractor (reuse ai-doc-analyse / intake where possible; create_knowledge opt-in)
  → Second-model critic (knowledge-critic) — mandatory
  → Admin or org Owner/Manager review
  → Published Knowledge
  → /knowledge, assistant-reasoner, Content Tree (internal), future checklists
```

## Internal Knowledge operations

Platform admin surface: `/admin/knowledge`.

**Top-level order:** Add Knowledge → Review → Ready to publish → Outputs → Overview.

### Add Knowledge — ADD | GAPS | UPDATE

Three distinct jobs under Add Knowledge:

| Job | Question | Behaviour |
|-----|----------|-----------|
| **ADD** | What are we learning? | Dedicated intake: one **Add source** surface (drag/select file, paste text, or URL). Spreadsheets use workbook interpretation; documents/URLs extract claims → applicability → critic → Review. Manual create remains secondary. |
| **GAPS** | What don't we know? | Coverage matrix over Knowledge (v1: topic × jurisdiction from live rows) plus a prioritised research queue. Future axes: property type, audience, claim completeness, affected property counts, market-expansion programmes. Content `evidence_gaps` must feed this same gap system — not a separate dead-end. |
| **UPDATE** | What might have changed? | Monitor authoritative sources on verified/published Knowledge. Detection creates **update candidates** (no silent rewrite of v1). Triage: no material change / potential material change / material claim supersession → critic → human review → new Knowledge version. |

```
ADD:    Source → extract claims → applicability → critic → Review
GAPS:   Coverage matrix → research queue → ADD sources
UPDATE: Monitor → detect → compare claims → critic → human review → new version
```

Closed loop with Outputs: Content that cannot substantiate a fact records a Knowledge gap; research closes it; published Knowledge powers Content again.

| Route | Behaviour |
|-------|-----------|
| **Add source (file)** | CSV/XLSX → deterministic workbook parse + AI sheet interpretation → mapping for Knowledge sheets. PDF/DOCX/TXT/images → `ai-doc-analyse` with `knowledge_intake` → proposed candidates → bulk import. |
| **Add source (URL)** | `knowledge-intake-url` (safe fetch, SSRF controls) → storage snapshot + `ai-doc-analyse` → same proposal review. |
| **Add source (paste)** | Pasted URL analysed as URL; pasted prose analysed as a text document. |
| **Manual** | Secondary form; single candidate with required applicability → create → critic. |

**Document ≠ one Knowledge row:** extraction may propose multiple distinct candidates. Admin selects/edits before import.

**Hard rules:** Upload never publishes. Every create runs `knowledge-critic`. Applicability (jurisdictions or explicit `unscoped`) is required. Spreadsheet retained as `knowledge_sources` metadata (filename, sheet, row). Structured spreadsheet columns land in `knowledge.attributes` (jsonb) and are also preserved as `knowledge_claims` (source-backed facts). Skip means explicit discard only. Do **not** assume every worksheet represents Knowledge rows: only `knowledge_data` sheets create candidates by default; `reference_context` sheets may inform interpretation and remain attached as provenance; `not_for_knowledge` sheets are excluded unless an admin overrides. If interpretation confidence is low, default to `reference_context`, not `knowledge_data`.

**Claims (depth under the headline):** Title/summary stay concise. Extractors write atomic claims with category, optional source location, and verification status — preserve all materially useful source facts (no fixed claim-count target). Missing source detail becomes `unknown` — never invented from general knowledge. Review UI lists each claim with status and source link; **Extract claims from sources** re-reads linked URLs/documents into claim rows. Critic reviews claims with guidance; human verify promotes `extracted` → `verified` while unknowns remain gaps. Content SEO/brief/output packages **verified claims only**; after each output draft, a separate grounding critic flags unsupported factual additions.

**Org uploads (future/customer):** same `ai-doc-analyse` extraction; default scope `organisation` via `create_knowledge_candidate` — not platform admin bulk RPCs.

**Standard attribute keys (conventions, not columns):** `category`, `legal_status`, `applies_when`, `action`, `frequency`, `timing`, `evidence`, `responsible_party`, `professional_required`, `insurance_relevance`, `risk_or_consequence`, `priority`, `lead_time_days`, `app_logic`, plus custom slug keys from source headers.

## Content Tree (internal)

After Knowledge is verified/published: `/admin/knowledge` → **Outputs** (Content tree).

Stages: Knowledge → SEO → Brief → Outputs (`core_article`, `faq`, `in_app_tip`) → Creative/Publishing stubs.

Approved outputs are not silently overwritten; upstream changes mark `needs_update`. Ungrounded SEO/output needs become Knowledge gaps (same GAPS queue), not orphaned content-only notes.

## Review ownership

* Organisation scope: Owner/Manager in-product.
* Platform + community: platform admins in `/admin`.
* Platform admins may override org rows via audited admin RPCs.

**Admin review UX:** Review is its own top-level tab (dense workbench). Ready-to-publish and detail sheet stay meaning-first. Draft guidance may be imported from owner action/task text or AI-proposed; drafts remain unverified until critic + human verify. Guidance quality states: Missing → Needs improvement → Meaningful draft → Verified. Short circular imports (e.g. “as required” without conditions) need **Improve guidance**. Editing critic-relevant fields invalidates the prior critic (`stale_after_guidance_edit`); primary action becomes **Run critic**, never Verify against a stale result. Batch actions: generate missing, improve weak, run critic for eligible — never batch Verify/Publish. Lifecycle: Candidate → draft guidance → critic → human verification → ready to publish → publish. Critic and human verification are mandatory; nothing auto-verifies or auto-publishes. `admin_set_knowledge_status` gates verify/publish server-side (quality guidance, authoritative source, current critic pass, applicability, human verifier) and rejects `candidate → published` (`verify_before_publish`). Check states: Passed / Failed / Incomplete / Not run / Required — never mark Passed when a check did not run. `trust_score` is ranking-only and never overrides mandatory gates.

## Privacy

Community candidates extend Filla Brain only. No community statistic may be published unless `cohort_size >= BRAIN_MIN_COHORT` (5), enforced in SQL/RPCs.

## Metrics

Measure Knowledge alongside tasks, AI requests, and organisations:

| Metric | Definition |
|--------|------------|
| Knowledge created | Rows in `knowledge` (org or platform) |
| Knowledge verified | Rows with `status` in `verified` \| `published` |
| Knowledge reused | `knowledge_usage_events` type `reused` (assistant cite, link, etc.) |
| Questions answered | Assistant turns that cited published Knowledge (`question_answered`) |
| Automation created | Discovery/`operational_discovery` candidates (`automation_created`) |
| Time saved | Sum of `estimated_minutes` on `time_saved` events (defaults: 5m answered, 2m reuse, 10m automation) |

Admin: `/admin/knowledge` → Metrics tab (`admin_knowledge_metrics_snapshot`).  
Org: `/knowledge` metric chips (`org_knowledge_metrics`).  
Product analytics: PostHog events `knowledge_*` via `src/lib/knowledge/knowledgeTelemetry.ts`.

## Non-goals

* Parallel “Knowledge Engine” or second admin app
* Assistant knowledge-only mode
* Auto-publish
* Injecting Knowledge into `property_graph_edges`
