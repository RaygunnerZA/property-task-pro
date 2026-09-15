# CHAPTER 30 — Phase 2: Knowledge First

**Status:** Implementation roadmap (not constitution)  
**Defers to:** `@Docs/03_Data_Model.md`, `@Docs/07_AI_Intelligence.md`, `@Docs/29_Knowledge.md`, `@Docs/Appendix_A.md`  
**On conflict, constitution wins.**

The next phase is to **complete the Knowledge capability**, not add new platform features.

**Constitutional north star (`@Docs/29_Knowledge.md`):** Admin Knowledge is a **decision system**, not a content-production CMS. Pipeline: WATCH → UNDERSTAND → JUDGEMENT → DISTRIBUTE. Expression path: **Knowledge Schedule → Review package → Approve distribution**. Incomplete automation belongs on the backlog — not as permanent admin workflow screens.

---

## Priority 1 — Complete the Knowledge loop

Finish the existing Knowledge system before expanding it.

Build in this order:

1. Applicability (jurisdiction, region, language, audience) — `knowledge.applicability` jsonb (shipped with Expression foundation)
2. **Knowledge Intake (v1):** Upload (CSV/XLSX + docs) + **Add URL** + Manual → candidates + sources + mandatory critic. (**URL shipped.** Paste deferred — see `@Docs/32_Phase3_Knowledge_Depth_And_Hardening.md`.)
3. Entity links (Properties, Spaces, Assets, Compliance, Tasks, Reports) — **remaining → Ch 32**
4. Provenance and verification history (admin detail Activity + `knowledge_sources` on Intake) — foundation shipped; deeper surfaces → Ch 32
5. Search — org ILIKE search shipped; richer search → Ch 32
6. Assistant citations (published Knowledge only) — **→ Ch 32**
7. Reuse, stale and superseded metrics — **→ Ch 32**

Harder Knowledge completion, Living Knowledge, Discovery, Expression automation, overnight Watch, and platform hardening are tracked in **`@Docs/32_Phase3_Knowledge_Depth_And_Hardening.md`**. Do not reopen those as drive-bys in Phase 2 PRs.

Knowledge remains guidance. It never replaces Tasks, Compliance, Records or Signals.

---

## Priority 2 — Living Knowledge

**Remaining → `@Docs/32_Phase3_Knowledge_Depth_And_Hardening.md`.**

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
- Enter Schedule preparation / Accept Knowledge when judgement requires — never auto-distribute.

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
- (target) discoveries discarded automatically, Schedule Now count, expressions skipped by score

Keep `trust_score` internal.

Product labels over the existing `status` enum (system states — not separate CMS crafts):

| Product emphasis | `status` |
|---|---|
| Needs review / Review package | `candidate` (and expression draft states) |
| Accepted (verified) | `verified` |
| Distributed / published | `published` |
| Stale | `stale` |

Do not add a fifth status column. `archived` remains an admin/system state.

---

## Priority 5 — Expression machinery (transitional)

Requires Applicability + Intake + review loop (Priority 1).

**Constitutional path:**

```
Knowledge Schedule (topic packages ordered by importance)
  → Review package (Understanding · Judgement · Expression · image concept)
  → Approve distribution
```

**Topic package layers:** international expression + regional Knowledge layers + shared visual family; property-specific remains in-app only. Regional layers need not each become separate published articles. Image flow: 2×2 concept grid → square master → vertical/horizontal derivatives → approve with package.

**Shipped / transitional tables** (`content_topics`, strategy, SEO envelopes, format briefs, `content_outputs`) remain as Expression/Distribution **implementation metadata**. Progressive plan/content UI and stage trees are **escape hatches** / Pilot Mode tuning controls while automation catches up — not permanent human duties.

Creative and Publishing stage envelopes may remain stubs until the visual-family flow ships. Admin: `/admin/knowledge` — **target default = Knowledge Schedule** (Now / Next / Later / Monitoring). No customer nav changes. No external publish integrations required for Judgement.

**Pilot before automating transitions:** (1) international + one strong regional layer (chimney / France); (2) multi-region comparison; (3) regional-only that must not become international.

---

## Priority 6 — Distribution

Reuse existing targeting.

Do not build a separate distribution engine or CMS.

Use existing identity, applicability and notification rules for:

- in-app guidance
- **seasonal packages** (`seasonal_packages` — Distribution channel over published Knowledge; see `@Docs/03_Data_Model.md` / `@Docs/29_Knowledge.md`)
- website
- newsletters
- future channels

Seasonal packages are Distribution, not a second Knowledge store and not Signals.

---

## Development Rule

> **Prefer completing an existing Knowledge, Discovery or Admin judgement loop before adding a new capability, page or pipeline.**

> **No human should perform a task merely because the system has not yet automated it** (`@Docs/29_Knowledge.md`). Put unfinished automation on Ch 32 — do not constitutionalise temporary screens.

The goal is to make verified Knowledge more useful inside the existing Filla workbench; Expression and Distribution are machinery under Knowledge.
