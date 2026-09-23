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

---

## Constitutional principle (Admin Knowledge)

**Admin Knowledge is not a content-production system. It is a decision system.**

The system's job is to continuously discover potentially valuable knowledge, establish what is true, decide whether it matters, and get an approved expression into the world when warranted. Everything else is machinery.

> **The system continuously discovers, verifies, contextualises and propagates Knowledge; humans intervene only where judgement, accountability or publication risk requires them.**

> **No human should perform a task merely because the system has not yet automated it.**

If a temporary implementation detail appears as an admin workflow (choose topic → approve strategy → review brief → …), it belongs on the **automation backlog**, not in the constitution as a permanent human duty.

### Pipeline (machine)

```text
WATCH → UNDERSTAND → JUDGEMENT → DISTRIBUTE
```

Only **Judgement** is primarily human.

### Operational human interventions

For **expression and distribution**, the administrator experiences only:

```text
Schedule → Review package → Approve distribution
```

Everything else is machine work or an Exception.

| Step | Question | Human action |
|------|----------|--------------|
| **1. Review package** | Is this topic worth expressing, with correct layers and content family? | Accept for production (authorises generation) / Correct / Narrow / Do nothing |
| **2. Approve distribution** | Is the finished package ready for a channel? | Approve all eligible outputs (hold individuals as exceptions). **Does not** publish or execute channels. |
| **3. Exception** | Does risk demand a second opinion? | Expert / dual review only |

**Accept for production** authorises generation of the expression family. **Approve distribution** marks the completed package approved and ready for a channel — it must not imply anything was distributed or published while channel execution remains out of scope.

**Verify** and **Publish** are **system states** (and DB status values), not user workflow steps. Do not use “Publish” for earlier machine states.

Raw Knowledge deltas (new claims before a topic package exists) still require **Accept Knowledge** where judgement demands it — preferably inside Review package Judgement, not as a separate CMS craft.

A schedule row / review card should look like a **topic package**, not an article factory:

> Chimney and flue sweeping — Autumn · High priority  
> International ready · FR ready · DE research gap · UK N/A  
> Article · Social carousel · Image family · Scheduled 18 Sep → **Review package**

Not a CMS of topics, strategies, and briefs for the admin to shepherd.

### Target control-room surface: Knowledge (one page)

**One Knowledge page.** No routine Schedule / Review / Ready to publish / Advanced / Overview tab bar.

| Element | Role |
|---------|------|
| **Header** | Knowledge · Search · Filter · **Add source** · Overflow (Pilot / advanced machinery / reporting) |
| **Filters** | Needs attention · Scheduled · Monitoring · Complete (workflow state) |
| **Source filters** | Why the subject entered the queue: Regulatory updates · Official guidance · **Potential change** · Seasonal · Knowledge gaps · User demand · Property work patterns · All sources. A subject matches when **any** of its discovery signals match. News and consultations are **Potential change**, never `regulatory_update`. |
| **Watch settings** | Compact control (not a dashboard): Automated research Paused/On · Research allowance Light/Standard/Thorough · monthly usage · Run Watch now · **Official Source Catalogue** (approve the shape of bounded official sections once). Limits enforced **server-side**. |
| **Scheduled** | Editorial calendar of **Proposed** (machine) and **Confirmed** (human accepted for production) packages — neither means published or distributed |
| **Row unit** | **Subject package** (aggregated Knowledge + optional content_topic) — not atomic jurisdiction rows, not individual articles |
| **Primary actions** | Context-sensitive when a decision exists: **Accept plan** · **Review drafts** · **Resolve gap** · **Approve distribution** · **View**. No button when the machine is still working. |

**Needs attention** may only contain genuine human decisions (complete proposed plan awaiting accept, valid drafts awaiting review, source/applicability exceptions, distribution approval, an important new subject, a material official-source change that may alter accepted claims, conflicting official sources). Do **not** put “Planning queued” or “a new GOV.UK page was found” there — that is Monitoring. Premature drafts do not unlock Review drafts until the plan is accepted.

**Official Source Catalogue.** Catalogue review finds the bounded official sections Filla should care about. Coverage Watch detects new, changed or withdrawn official guidance inside accepted sections. News Watch detects developments that might eventually affect guidance. Knowledge is created only after an authoritative source supports actionable claims. A large GOV.UK service-result page (for example Housing, local and community) is orientation only — not a source and not the queue. The human activity is approving the shape of a small official catalogue once, then reviewing only consequential changes.

Queue lanes for Watch detections:

| Detection | Queue |
|-----------|--------|
| New page being assessed, news lead, unchanged tracked source | **Monitoring** |
| Important new subject, material source change, conflicting official sources, applicability decision | **Needs attention** |
| Accepted Knowledge work with a production plan | **Scheduled** |
| Verified Knowledge and expressions, still monitored for source changes | **Complete** |

A useful news detection reads as **Potential change**: announcement or consultation noted; no enacted legislation or updated operational guidance; current guidance remains valid; Filla monitors the linked pages. Most news is discarded as irrelevant. The remainder usually sits in Monitoring without a human decision. Do not rewrite Knowledge from news.

Watch stores per accepted page: canonical path and GOV.UK content ID, public update timestamp, relevant-section hashes, extracted claims and passage references, affected Knowledge IDs. A scheduled check compares metadata first and analyses the body only when a meaningful change is detected. Initial England watchlist is six families: landlord duties and renting; building regulations and Approved Documents; planning and permitted development; EPC and energy standards; HSE property-safety guidance; Building Safety Regulator guidance. Add sections only when genuine Knowledge gaps remain.

**Scheduled** answers: what Filla proposes, in what order, why then, which regions support it, and whether the entry is Proposed or Confirmed. Planning resumes into Proposed calendar only — never auto-accept, never draft unaccepted plans, never distribute.

**Accept plan** moves Proposed → Confirmed and may then generate drafts. **Approve distribution** marks channel-ready — does not publish. Do not use “Ready to publish”.

Compact queue rows: title · coverage · state/reason · one action if required. Forms show only after a recommendation exists (“Assessing opportunity” before that).

---

## Truth hierarchy (non-negotiable)

```text
SOURCE
  → EVIDENCE
  → CLAIMS
  → KNOWLEDGE
  → EXPRESSION
  → DISTRIBUTION
```

**Never** invert this to `Sources → AI article → website`.

The content generator must never become the source of truth. Published content is a **projection** of verified Knowledge. One Knowledge change can update many expressions; when Knowledge goes stale, lineage knows which projections may be wrong.

**Not every Knowledge event produces content.** The machine decides: new? reliable? important? does anyone need to know? does existing content need changing? → create / update / **do nothing**. An enormous amount of work should terminate before any writing LLM job.

---

## Axes

| Axis | Values |
|------|--------|
| `scope` | `platform` \| `organisation` |
| `status` | `candidate` \| `verified` \| `published` \| `stale` \| `archived` |

Source kinds (provenance): `filla_curated` \| `org_upload` \| `operational_discovery` \| `community_brain`.

Status values remain in the schema. Product UI emphasises **Schedule / Review package / Approve distribution**, not “Verify” and “Publish” as separate crafts.

## Flows

```
WATCH / ADD source / GAPS research / UPDATE detect
  → Evidence + atomic claims
  → Compare existing Knowledge, critic, score importance
  → Accept Knowledge when judgement requires (often inside Review package)
  → Score into Knowledge Schedule (Now / Next / Later / Monitoring)
  → Review package (Understanding · Judgement · Expression · image concept)
  → Produce finished family (machine)
  → Approve distribution
  → Channels (in-app, seasonal, web, social) as machinery
```

Customer / org surfaces: `/knowledge`, assistant-reasoner, Living Knowledge, seasonal guidance — consume **published** Knowledge and approved expressions only.

---

## Internal Knowledge operations (implementation)

Platform admin surface: `/admin/knowledge`.

**Target default centre:** **Knowledge Schedule** (ordered topic packages). Knowledge **Review** remains for Accept Knowledge on candidates. **Advanced** retains Outputs / stage trees as escape hatches. Desktop (1280px+): full-width Knowledge canvas; Add Knowledge in a reserved right action column (Add | Gaps | Update). Gaps and Update occupy the centre when selected from the rail.

### Intake machinery — ADD | GAPS | UPDATE

These are **machine and override paths** that feed Schedule preparation / Accept Knowledge — not three equal “jobs” the admin must live in daily.

| Path | Question | Behaviour |
|------|----------|-----------|
| **ADD** | Manual / override capture | One **Add source** surface (file, paste, URL). Spreadsheets / docs / URLs → claims → applicability → critic → Accept path. Manual create secondary. |
| **GAPS** | What don't we know? | Coverage matrix + research queue. Discovery → URL intake → candidates → critic. Never auto-distributed. Expression `evidence_gaps` feed this same gap system. |
| **UPDATE** | What might have changed? | Monitor authoritative sources. Detection creates **update candidates** (no silent rewrite). Critic → Accept / new Knowledge version → Schedule impact. |

**Gap research batching:** Bulk research enqueues durable `ai_batch_jobs` (Gemini Batch discovery; max 20 cells). Intake of unique URLs remains SSRF-safe via `knowledge-intake-url`. Never auto-distributed.

| Route | Behaviour |
|-------|-----------|
| **Add source (file)** | CSV/XLSX → workbook parse + interpretation. PDF/DOCX/TXT/images → `ai-doc-analyse` (`knowledge_intake`) → candidates. |
| **Add source (URL)** | `knowledge-intake-url` → snapshot + analyse → same proposal path. |
| **Add source (paste)** | URL-as-URL or prose-as-document. |
| **Manual** | Secondary; single candidate with required applicability → critic. |

**Document ≠ one Knowledge row:** extraction may propose multiple candidates.

**Hard rules:** Upload never distributes. Every create runs `knowledge-critic`. Applicability (jurisdictions or explicit `unscoped`) required. Spreadsheet provenance in `knowledge_sources` metadata. Structured columns → `knowledge.attributes` and `knowledge_claims`. Skip = explicit discard. Only `knowledge_data` sheets create candidates by default; low-confidence interpretation defaults to `reference_context`.

**Claims:** Title/summary stay concise. Extractors write atomic claims; missing detail is `unknown` — never invented. Human Accept promotes `extracted` → `verified`; unknowns remain gaps. Expressions consume **verified claims only**. Grounding critic on drafts flags unsupported additions. Editing authoritative sources invalidates critic until re-run.

**Structured fields from claims:** Classification, trigger, applicability, timing, action, evidence and responsible party are inferred from verified claims and repaired automatically. A candidate must not be blocked by a field those claims already establish. Mixed `must` / `should` is a classification (`mandatory_with_recommendations`), not a missing field. Humans resolve only remaining material ambiguity.

**Knowledge set:** One source may yield several coherent requirements and recommendations. Present them as a set with child groups — do not compress every claim into one blended guidance sentence. Legal strength stays distinct: `must` (obligation), `should` (official recommendation), exception, explanatory. The critic reviews each claim (supported / partially supported / unsupported / overstated) against an exact passage, including modal strength.

**Durable vs seasonal:** Landlord gas-appliance maintenance is durable compliance Knowledge. A seasonal package may reuse it later; it must not inherit seasonal applicability from the package topic.

**Org uploads (future):** same extraction; default `organisation` scope via `create_knowledge_candidate`.

**Standard attribute keys (conventions, not columns):** `category`, `legal_status`, `applies_when`, `action`, `frequency`, `timing`, `evidence`, `responsible_party`, `professional_required`, `insurance_relevance`, `risk_or_consequence`, `priority`, `lead_time_days`, `app_logic`, plus custom slug keys.

### Overnight machine (target)

Region by region (watch profiles for CH / UK / FR / …):

**Watch → detect → compare → investigate → cross-check → score → prepare Schedule**

For international pilot subjects (chimney, heating, smoke/CO, gutters), Watch must **expand jurisdiction coverage** even when one region is already published — missing England / Scotland / France / Switzerland cells are researched under the allowance. Bad discovery URLs are labelled **source needs repair** (not Review stubs). France-only Knowledge may Accept a regional guide plan; international article/social stay blocked until ≥2 regions are sourced.

By morning the admin should not see hundreds of discoveries. They see an ordered **Knowledge Schedule** (Now / Next / Later / Monitoring). Everything else discarded, merged, scheduled, incorporated, or deemed irrelevant — without writing LLM jobs where scoring says “do nothing.”

AI economics: batch/overnight for watch, extraction, research, draft expressions, concept grids; stronger interactive models for critic and high-risk Judgement paths only. Prefer **update existing expression** over new article when related content exists.

---

## Expression & Distribution (machinery under Knowledge)

**Not a CMS.** Tables such as `content_topics`, `strategy`, SEO envelopes, `content_format_briefs`, and `content_outputs` are **implementation metadata** under Expression / Distribution. Administrators must not shepherd Topic → strategy → brief → article as a permanent workflow.

Visible workflow:

```text
Knowledge Schedule
  → Review package
  → Approve distribution
```

Canonical machine order:

```text
Verified Knowledge
  → (score) deserve expression? / do nothing?
  → Topic package on Schedule (importance order)
  → Review package (human)
  → Draft family + image flow (machine)
  → Approve distribution (human)
  → Derivatives + channels
```

### Topic package layers

Each scheduled topic may contain:

```text
Topic
├── International expression
├── France layer
├── UK layer
├── Germany layer
└── Property-specific guidance (in-app only — not a scheduled marketing deliverable)
```

| Layer | Rules |
|-------|--------|
| **International** | Universal property-care principle; why it matters; 3–5 meaningful regional distinctions; location-neutral preparation; links into regional guides; **never** present one country’s rule as universal |
| **Regional** | Exact applicable rule; official sources; frequency, responsibility, evidence; exceptions/local variation; regional CTA; unsupported gaps explicit. Supports the international expression; **not required** to become a separate published article every time |
| **Property-specific** | Generated only in-app when jurisdiction + property attributes are known. Never a scheduled international marketing output |

### Content scope (expression policy)

| Scope | Intent |
|-------|--------|
| `international_overview` | Concise cross-region framing; cautious comparisons; no false precision |
| `regional_comparison` | Explicit multi-jurisdiction comparison |
| `country_guide` | One country / jurisdiction in depth |
| `local_guide` | Sub-national precision when sources support it |
| `property_specific` | Exact jurisdiction + known property context (in-app only) |

International marketing uses representative distinctions only. In-app / property-specific requires exact jurisdiction — exclude until known (`not_applicable`, not a Knowledge defect). Gap semantics: **`not_yet_researched`** vs **`not_applicable`**.

SEO opportunity fields (query clusters, market, confidence, search-evidence vs factual grounding) are **machine inputs to Schedule ranking and honesty**, not a human SEO craft. Without live search data, label **Editorial SEO hypothesis** — never claim search-backed evidence that was not consulted.

### Review package (one workspace)

Opening a scheduled topic shows **one** coherent review — not several stage screens.

The reviewer surface is **decisions only**. Lead with the title, a coverage line of what is actually reviewable (covered / candidate found), and one **Review {region}** button per candidate. Do not list researching nations on that line — they are machine work, not a place to click. If Watch is still looking for other regions, that copy lives behind **Evidence and activity** (or as Ready to research when no candidate exists). A Knowledge candidate waiting for accept puts the package in **Needs attention** — never “No decision required.” Landlord gas-appliance Knowledge found during the heating window is reviewed on **Before the heating season**; the Knowledge title and applicability stay durable. In-app tips are not planned from international or regional-comparison scope; they need an exact applicable jurisdiction or property. Do not create output placeholders until coverage and the accepted plan make those formats eligible. Research state must be truthful: if Watch automated research is On and there is no candidate, show Researching with last and next attempt and no manual research button; if it is paused, show Ready to research and the button.

| Section | Contents |
|---------|----------|
| **Understanding** | Why selected; audience/objective; international angle; regional distinctions; sources; missing or conflicting information |
| **Judgement** | Approved claims; claims permitted internationally; region-restricted claims; excluded claims; machine recommendation: proceed / narrow / do nothing |
| **Expression** | Content family together: international article; regional guide where warranted; social carousel; short post; newsletter excerpt; in-app eligibility; visual direction |

Reviewer may edit the plan, add/remove a region or format, request regeneration, or accept the package for production. **Do not** require separate manual approval of SEO, parent strategy, or every child brief when automated checks pass.

**Review package gate:** topic worth expressing; international/regional boundaries correct; content family appropriate; selected image concept directionally right.

**Approve distribution gate:** finished copy, regional distinctions, sources, final image family, channels, dates — one primary action for all eligible items; hold individuals as exceptions. Machine states (source check, critic, render, derivatives) visible **only when something fails**.

### Image flow (inside the topic package)

Images belong to the topic package, not an isolated creative module. Sequence:

```text
Expression approved for drafting
  → Generate 2×2 low-resolution concept grid
  → Select or revise one concept
  → Generate square master
  → Review master
  → Generate vertical + horizontal derivatives (+ thumbnail from square)
  → Approve image family with the content package
```

**Concept grid inputs:** topic + communication objective; paper-cut brand specification; required/prohibited elements; international sensitivity; text-safe requirements; approved style references.

**Derivatives:** Square = primary reusable composition. Vertical = subject high; darker quiet lower text-safe area. Horizontal = subject right; darker quiet left text-safe area. Thumbnail from approved square. **Do not bake marketing text into artwork** — add text at distribution/application layer.

**Paper-cut style:** limited illustrative detail; visible paper texture and subtle noise; highlights on top and left paper edges; fine consistent drop shadows toward bottom right; no sculptural/inflated 3D; no transparency; no baked-in text.

Reuse one visual family internationally unless a regional difference makes the illustration inaccurate or culturally inappropriate. Regional image variants are **exceptions**, not the default.

### Pilot mode (before full automation)

For early topics, expose **tuning controls** inside Review package — not permanent workflow stages:

- Regenerate understanding
- Add or remove a region
- Generate drafts
- Generate image concepts
- Regenerate selected format
- Run checks again

**Pilot three flows before automating transitions:** (1) international topic with one strong regional layer (e.g. chimney + France); (2) multi-region comparison; (3) regional-only topic that must **not** become international content.

**Transitional UI:** `/admin/knowledge` → Outputs / stage trees remain escape hatches / debug until Schedule ships. Prefer collapsing them into Schedule → Review package → Approve distribution.

**In-app seasonal packages** are a **distribution channel**, not Knowledge and not a CMS. Path: published Knowledge → approved tip wording → `seasonal_packages` → Home / Living Knowledge. Packages own presentation and timing only. Customer gate: `list_active_seasonal_packages`. DB status remains `draft | approved | archived`; Live/Scheduled are derived from approved + display window.

**Grounding loop:** Ungrounded expression needs become Knowledge gaps (same GAPS system). Upstream Knowledge changes mark expressions `needs_update` / stale via lineage — never silently invent facts.

---

## Review ownership

* Organisation scope: Owner/Manager in-product.
* Platform + community: platform admins in `/admin`.
* Platform admins may override org rows via audited admin RPCs.

**Judgement gates (server):** Critic and human Accept are mandatory for adopting Knowledge. Nothing auto-accepts or auto-distributes high-risk / legal content without the configured gate. `admin_set_knowledge_status` remains fail-closed (quality guidance, authoritative source, current critic pass, applicability, human actor) and rejects `candidate → published` (`verify_before_publish`). Check states: Passed / Failed / Incomplete / Not run / Required — never mark Passed when a check did not run. `trust_score` is ranking-only (and feeds Schedule ranking, never replaces human gates).

**Batch:** Guidance / improve / gap research / overnight expression drafts / concept grids use `ai_batch_jobs` where enabled; drafts stay unverified until Judgement. Never batch-Accept or batch-Approve distribution.

**Low-risk vs high-risk:** Maintenance tips and non-legal innovation may allow a single Approve distribution after Review package. High-impact legal/regulatory changes may require Exception (second reviewer).

## Privacy

Community candidates extend Filla Brain only. No community statistic may be published unless `cohort_size >= BRAIN_MIN_COHORT` (5), enforced in SQL/RPCs.

## Metrics

| Metric | Definition |
|--------|------------|
| Knowledge created | Rows in `knowledge` (org or platform) |
| Knowledge verified | Rows with `status` in `verified` \| `published` |
| Knowledge reused | `knowledge_usage_events` type `reused` |
| Questions answered | Assistant turns that cited published Knowledge |
| Automation created | Discovery/`operational_discovery` candidates |
| Time saved | Sum of `estimated_minutes` on `time_saved` events |

Admin: Overview / metrics snapshot under **Reporting** (outcomes + Watch automation state, recent Watch runs with trigger/result, overnight & gap-research jobs). Org: `/knowledge` chips. PostHog: `knowledge_*` telemetry.

Prefer control-room metrics: discoveries discarded automatically, Schedule Now count, time-to-Review-package, time-to-Approve-distribution, expressions skipped by score (“do nothing”).

## Non-goals

* Parallel “Knowledge Engine” or second admin app
* Treating Admin Knowledge as a CMS or article factory
* Exposing strategy / SEO / brief / critic / image / output machines as separate human workflow stages
* Permanent human workflows that exist only because automation is incomplete
* Treating property-specific guidance as a scheduled marketing deliverable
* Requiring every regional layer to become a separate published article
* Baking marketing text into final artwork
* Assistant knowledge-only mode
* Unconditional auto-distribute of high-risk legal content
* Injecting Knowledge into `property_graph_edges`
* Requiring every Knowledge event to produce public content
