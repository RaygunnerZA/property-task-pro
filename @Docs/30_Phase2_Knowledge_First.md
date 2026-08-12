# CHAPTER 30 — Phase 2: Knowledge First

**Status:** Implementation roadmap (not constitution)  
**Defers to:** `@Docs/03_Data_Model.md`, `@Docs/07_AI_Intelligence.md`, `@Docs/29_Knowledge.md`, `@Docs/Appendix_A.md`  
**On conflict, constitution wins.**

The next phase is to **complete the Knowledge capability**, not add new platform features.

---

## Priority 1 — Complete the Knowledge loop

Finish the existing Knowledge system before expanding it.

Build in this order:

1. Applicability (jurisdiction, region, language, audience) — requires Ch 3 schema update first
2. Entity links (Properties, Spaces, Assets, Compliance, Tasks, Reports). Add Records only after updating the data model.
3. Provenance and verification history
4. Search
5. Assistant citations (published Knowledge only)
6. Reuse, stale and superseded metrics

Knowledge remains guidance. It never replaces Tasks, Compliance, Records or Signals.

---

## Priority 2 — Living Knowledge

Surface Knowledge inside existing workflows.

Show contextual guidance within:

- Assets
- Compliance
- Tasks
- Reports
- Entity context panels / Action Layer

Keep guidance:

- contextual
- dismissible
- secondary to work
- always cited

Do not create new navigation.

---

## Priority 3 — Discovery

Improve Discovery quality.

Discovery should create two outputs:

**Recommendations**

- Short-lived operational suggestions.
- Never become Knowledge automatically.

**Knowledge Candidates**

- Durable facts requiring review.
- Enter the Knowledge review workflow.

Use critic score, frequency, deduplication and Filla Brain cohort rules before creating candidates.

---

## Priority 4 — Measure the loop

Instrument the entire Knowledge lifecycle.

Extend existing metrics (`knowledge_usage_events`, `admin_knowledge_metrics_snapshot`, `org_knowledge_metrics`, `ai_requests`) — do not invent a parallel metrics system. See `@Docs/29_Knowledge.md`.

Measure:

- candidate volume
- approval rate
- rejection reasons
- reuse
- stale rate
- AI cost
- latency

Keep `trust_score` internal.

Users only see labels over the existing `status` enum:

| User label | `status` |
|---|---|
| Needs Review | `candidate` |
| Verified | `verified` |
| Published | `published` |
| Stale | `stale` |

Do not add a fifth status column. `archived` remains an admin/system state.

---

## Priority 5 — Internal Editorial

Only after the Knowledge loop is stable.

Generate:

```
Knowledge → SEO Brief → One article type → Human review → Publish
```

Do not build a multi-format content platform yet.

---

## Priority 6 — Distribution

Reuse existing targeting.

Do not build a separate distribution engine.

Use existing identity, applicability and notification rules for:

- in-app guidance
- website
- newsletters
- future channels

---

## Development Rule

> **Prefer completing an existing Knowledge, Discovery or Admin workflow before adding a new capability, page or pipeline.**

The goal is to make verified Knowledge more useful inside the existing Filla workbench before expanding into editorial, marketing or public content.
