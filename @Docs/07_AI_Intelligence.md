# CHAPTER 7 — AI INTELLIGENCE ARCHITECTURE

**7.1 — PURPOSE**
AI is an advisor, extractor, and critic. It never overrides user decisions.
AI never auto-publishes Knowledge. Humans decide publish/archive.

**7.2 — THE STACK**
Input → Interpretation (Vision/OCR) → Structuring → Critic → Intelligence (Flags) → Interaction.

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
*   Community Knowledge extends Filla Brain anonymised patterns (`data_sharing_level`); promotion requires `cohort_size >= BRAIN_MIN_COHORT` (5) in code/SQL.

**7.5 — DISCOVERY**
Discovery is a process (not a parallel product entity). It observes existing operational data and emits organisation-scoped Knowledge **candidates** or non-mutating recommendations. It never edits Tasks, Compliance, Records, Messages, or Signals.

**7.6.1 — AI & NAVIGATION**
The Adaptive Context Navigation provides a structured intent surface for AI.
AI uses `entity_type` and `active context` to prioritise actions in the Action Layer. AI never invents navigation items.