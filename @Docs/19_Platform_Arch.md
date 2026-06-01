# CHAPTER 19 — PLATFORM ARCHITECTURE

STATUS: CANONICAL

This chapter is a source of truth.

Implementation documents must defer to this chapter.

**19.1 — PRINCIPLES**
Modular, Event-Driven, Signal-Based.

**19.3 — SIGNALS LAYER**
Every subsystem emits events (`asset.risk_detected`, `compliance.expiring`).

**19.17 — NAVIGATION, SCOPE, AND CONTEXT PANELS**
Navigation and Platform Structure

Filla is an event-driven platform built on signals, relationships and context.

However, users should not be exposed directly to platform complexity.

⸻

Signals Are Infrastructure

Signals are the foundation of the platform.

Examples:

* Uploads
* Photos
* Emails
* Messages
* Weather events
* Compliance events
* AI detections

Most users should never manage signals directly.

Signals are transformed into:

* Tasks
* Records
* Reminders
* Calendar events
* Insights

through platform services.

⸻

User Experience

The platform is signal-driven.

The user experience is work-driven.

Frontline users primarily interact with:

* Work
* Checklists
* Evidence
* Completion

Managers primarily interact with:

* Work
* Outcomes
* Risks
* Decisions

Portfolio users primarily interact with:

* Intelligence
* Trends
* Reporting

⸻

Navigation

Navigation may expose stable activity areas.

Examples:

* Home
* My Work
* Calendar
* Properties
* Knowledge
* Reports

Navigation is not generated directly from signals.

Signals remain infrastructure.

Context and permissions determine which activity areas are available.

⸻

Scope

Property selection is a scope mechanism.

Property selection filters activity areas.

Property selection should not create duplicate navigation structures.

The same activity may be viewed:

* Across all properties
* Within a single property
* Within a portfolio subset

without changing the underlying activity area.

⸻

Context Panels

Context panels are the primary way users inspect an entity without leaving their current activity area.

Examples:

* Task detail (Overview, Checklist, Evidence, Activity — see **05_Task_Engine.md** §5.6 and **Appendix_A.md**)
* Asset detail
* Property context
* Compliance record

On desktop, panels should slide over or sit beside the centre work surface; the work surface stays visible when practical (**04_UI_System.md**).

On mobile, the same contexts may use full-screen flows when execution requires focus.

⸻

Action Layer

The **Action Layer** is not a navigation domain. It is the set of **in-context actions** available for the current entity and permission set (create task, upload evidence, assign, complete checklist item, etc.).

* **AI** (**07_AI_Intelligence.md**) uses `entity_type` and active context to prioritise Action Layer affordances; it must not invent new top-level navigation items.
* **Messaging** (**13_Messaging.md**) appears inside entity context (e.g. Task Activity) or via Action Layer entry points — not as a standalone app area.

If a feature proposal adds a global “Actions” or “Messages” tab, reconcile it with **02_Identity** (activity areas) and this section first.