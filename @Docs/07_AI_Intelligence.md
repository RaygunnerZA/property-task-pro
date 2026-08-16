# CHAPTER 7 — AI INTELLIGENCE ARCHITECTURE

**7.1 — PURPOSE**
AI is an advisor, extractor, and critic. It never overrides user decisions.
AI never auto-publishes Knowledge. Humans decide publish/archive.

**7.2 — THE STACK**
Input → Interpretation (Vision/OCR) → Structuring → Critic → Intelligence (Flags) → Interaction.

**7.2.1 — CAPABILITIES, STRATEGIES AND THE CALL BOUNDARY**

Callers never name models. An edge function asks for a **capability** and the boundary decides how it gets done.

*   **Capability** — a job with a contract: `task_extraction`, `document_analysis`, `photo_asset_identification`, `compliance_clause_rewrite`, `knowledge_critique`, `plan_label_extraction`. Each declares requirements (`vision`, `pdf`, `structuredJson`) and pins a `promptVersion`.
*   **Strategy** — how the job is done. A strategy is either `model:*` or `deterministic:*`. **Deterministic strategies are first class, not a consolation prize:** rule-based task extraction and vector-PDF text extraction are strategies inside the boundary, not fallbacks bolted outside it. The cheapest correct answer is the one that needed no model.
*   **Resolution** — the boundary filters approved strategies by the capability's requirements, the call's input traits (a PDF input excludes models that cannot accept one), configured credentials, and any provider-distinctness constraint; then orders them by preference. Empty means the job cannot run — which is the correct answer, not an error to route around.

All of this lives in **code** (`supabase/functions/_shared/aiRouting.ts`), so a model change is a reviewable commit. The database holds only emergency pins (`ai_route_overrides`, see Ch 3); a pin reorders approved strategies and can never authorise an unapproved one or escape a requirement.

Every AI call passes through `_shared/aiCall.ts`, which does five things in order:

1.  **Gate** the org's AI allowance.
2.  **Resolve** the capability to an ordered list of strategies.
3.  **Validate** the response against the capability's declared shape.
4.  **Retry once** on an invalid shape, then **fall back** to the next strategy. These are different failure modes and are not conflated: fallback means the primary failed, escalation means the result was poor. Cross-provider fallback is opt-in per capability, because sending customer content to a second vendor is a deliberate choice, not a default.
5.  **Log** one `ai_requests` row per provider call, with model, prompt version, tokens, cost and status.

Step 5 is a billing requirement: allowance is derived from `ai_requests`, so an unlogged call is a free call (Ch 20).

**Newer is not automatically better.** A model becomes primary because it scored better on Filla's own work, not because it was released. Promotion is judged on two kinds of evidence, and neither is sufficient alone:

*   **Production-derived** (representative, not comparable) — what real reviewers corrected or rejected, from `extracted_spaces` and `ai_resolution_audit`.
*   **Golden set** (comparable, not representative) — a fixed fixture set in `evals/fixtures`, scored by `npm run eval:ai`. Fixtures must be synthetic or explicitly consented (Ch 21).

Models are always compared as `(model, prompt_version)` pairs. A prompt tuned for one provider is not evidence about another.

**7.3 — CAPABILITIES**
*   **Image:** Asset recognition, condition detection.
*   **Audio:** Transcription, summarisation, action extraction.
*   **Flags:** Scarcity, Weather, Compliance Risk.
*   **Knowledge:** Draft candidates from uploads/intake/Discovery/Filla Brain; second-model critic writes trust score; humans publish.

**7.4 — KNOWLEDGE & THE ASSISTANT**
The assistant reasoner fans out to **sources**, not modes: tasks, compliance, assets, graph, and **knowledge**.
*   Knowledge source returns only `status = published` rows (platform + active org).
*   Answers cite sources (e.g. `knowledge` / knowledge ids) the same way other adapters push into `sources[]`.
*   Operational questions still use live org data; trusted facts use published Knowledge. No “knowledge-only” assistant mode.
*   Critic edge (`knowledge-critic`) must use a **different** model/provider than the extractor that drafted the candidate. Both calls log to `ai_requests`.
    *   This is an **enforced router constraint**, not guidance. `knowledge_critique` declares `requireDistinctProvider`, the caller passes `mustDifferFrom` (the extractor provider), and the resolver removes every strategy on that provider. A resolver that simply picked "the best model" for both roles would silently collapse the second opinion into a self-review.
    *   The constraint outranks operational levers: an admin route pin that would reuse the extractor's provider is filtered out.
    *   If distinctness cannot be satisfied — typically only one provider is configured — **no critic runs**. The candidate keeps its default trust score and stays unverified. Filla does not fake a second opinion by asking the same provider twice; the previous implementation did this when a key was missing.
    *   Covered by tests in `src/lib/ai/__tests__/capabilityRouting.test.ts`, which fail if the rule is removed.
*   Community Knowledge extends Filla Brain anonymised patterns (`data_sharing_level`); promotion requires `cohort_size >= BRAIN_MIN_COHORT` (5) in code/SQL.

**7.5 — DISCOVERY**
Discovery is a process (not a parallel product entity). It observes existing operational data and emits organisation-scoped Knowledge **candidates** or non-mutating recommendations. It never edits Tasks, Compliance, Records, Messages, or Signals.

**7.6.1 — AI & NAVIGATION**
The Adaptive Context Navigation provides a structured intent surface for AI.
AI uses `entity_type` and `active context` to prioritise actions in the Action Layer. AI never invents navigation items.