# Chapter 23 — FILLA Blended Intelligence Roadmap

**Status:** Living document  
**Purpose:** Formalises how FILLA evolves from a conversational helper into a visual-operational intelligence system — while preserving safety, privacy, and full user control.

---

## Overview

The roadmap has three phases:

- **Phase A:** Conversational Workbench — Assistant as command interface
- **Phase B:** Hybrid Visual + Conversational Assistant — FILLA sees and explains
- **Phase C:** Constrained Autonomous Steward — Safe automation when explicitly allowed

---

## Phase A — Conversational Workbench

**Status:** 70–80% complete

The assistant behaves like a natural-language command interface to the property graph, compliance layer, OCR, and AI metadata.

### ✔ A.1 Natural-Language Filtering (Implemented)

Users can ask:

- "Show me overdue compliance."
- "List assets older than 10 years."
- "Which tasks block Apartment 5?"

**Backend:** assistant-intent, assistant-reasoner, graph-query, compliance_portfolio_view, assets_view.

---

### ✔ A.2 Multi-Step Reasoning (Implemented)

The assistant chains queries automatically:

- "Find all gas assets → check expiry → propose tasks."

Already happening via the reasoner orchestrating multiple fetches.

---

### ◑ A.3 Rich Task Authoring Templates (Next Improvement)

**Current status:** Assistant produces basic task payloads.

**To complete A.3, add richer fields:**

- hazard weighting
- recommended priority
- due date prediction
- linked assets / spaces
- auto-suggested contractor
- expiry reasoning if compliance-related

---

### ◑ A.4 Conversational Data Entry

**Currently only supports:**

- link attachment → compliance doc

**Enhancement:**

- Create asset from conversation
- Create space from conversation
- Update metadata ("rename this space", "change asset status") with confirmation

---

### ◑ A.5 Context Memory

**Current:** Assistant receives the context of the panel it was opened from.

**Next:**

- Session memory within a conversation
- Example:
  - User: "Show me issues for this asset."
  - User: "Create tasks for the ones that are urgent."
- Assistant should implicitly know "this asset = same as before" until context is switched.

---

## Phase B — Hybrid Visual & Conversational Assistant

**Status:** Not started

This phase makes FILLA unique: combining visual understanding, document intelligence, and graph reasoning.

### B.1 Visual Query Mode

User drops or clicks an image → assistant can answer:

- "Is anything expired in this image?"
- "Identify all visible assets."
- "What hazards do you see?"

**Uses:**

- AI image analysis (already built!)
- Graph context (space/asset relationships)

---

### B.2 Document Query Mode

Inside the document drawer:

- "Summarise this."
- "What's missing?"
- "Does this require action?"

**Uses:**

- ai-doc-analyse
- compliance rules
- expiry interpretation

---

### B.3 Graph Conversational Layer

Allow questions like:

- "Show everything connected to this compliance issue."
- "Why does this boiler create a building-wide risk?"

**Uses:**

- graph-query
- graph-insight

---

### B.4 Workspace Mode

A temporary working set:

- selected assets
- selected tasks
- selected documents
- selected spaces

Assistant reasons across the whole set:

- "Prioritise these 12 items."

---

### B.5 Multimodal Responses

Assistant answers with:

- badges
- small graph visuals
- hazard icons
- expiry chips
- proposed tasks
- risk levels

Not just paragraphs.

---

## Phase C — Constrained Autonomous Steward

**Status:** Not started

Safe automation — only when explicitly allowed.

### C.1 Predictive Advisories (read-only)

Examples:

- "Asset 44 is trending toward failure."
- "These 3 compliance items deserve attention next week."

**Uses:**

- federated brain insight
- hazard patterns
- expiry drift

---

### C.2 Pre-Action Pipelines (requires approval)

Assistant can prepare:

- tasks
- links
- metadata fixes

But nothing executes without:

- "Yes, apply."

---

### C.3 Scheduled Intelligence (if enabled in settings)

Daily/weekly insights:

- "Risk increased in Building C."
- "Contractors overdue on 3 items."

Triggered via cron.

---

### C.4 Auto-Repair (opt-in, ultra-constrained)

Automatically fixes:

- icon mismatches
- orphan assets
- inconsistent categories
- missing expiry metadata

Everything logged + reversible.

---

## Adoption Curve (AI Preferences Panel)

This ties the roadmap together:

| Tier | Behaviour |
|------|-----------|
| 0 — Off | Assistant disabled |
| 1 — Helper | Answers questions, proposes actions |
| 2 — Workbench | Multi-step reasoning, visual & document understanding |
| 3 — Copilot | Workspace reasoning, predictive advisory |
| 4 — Advisor | Scheduled insights, risk ranking |
| 5 — Steward | Controlled auto-fixes, auto-scheduling |

Users can move between tiers at any time.

---

## Integration With Wave 2 (Federated Brain)

The roadmap blends all three philosophies:

- **A: Command Workbench** → FILLA is a superpowered query engine
- **B: Visual & Document Understanding** → FILLA sees what the user sees
- **C: Predictive Steward** → FILLA helps drive operations, safely

All customer data stays siloed. Only anonymised patterns enter the brain (already enforced with forbidden keys).

---

## UI Note: FILLA Speech-Bubble Icon

Use the little FILLA speech-bubble SVG icon as the universal Assistant icon. It should replace all Lucide icons currently being used for the Assistant button.
