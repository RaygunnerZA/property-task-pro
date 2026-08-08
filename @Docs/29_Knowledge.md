# CHAPTER 29 — KNOWLEDGE CAPABILITY

**Status:** Implementation guide (defers to constitution for schema/IA)  
**Canonical schema/RLS:** `@Docs/03_Data_Model.md`  
**Entity context:** `@Docs/Appendix_A.md` (KNOWLEDGE)  
**Assistant / critic:** `@Docs/07_AI_Intelligence.md`

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
  → Extractor (reuse ai-doc-analyse / intake where possible)
  → Second-model critic (knowledge-critic)
  → Admin or org Owner/Manager review
  → Published Knowledge
  → /knowledge, assistant-reasoner, future checklists/SEO
```

## Review ownership

* Organisation scope: Owner/Manager in-product.
* Platform + community: platform admins in `/admin`.
* Platform admins may override org rows via audited admin RPCs.

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
