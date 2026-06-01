# CHAPTER 19 — PLATFORM ARCHITECTURE

STATUS: CANONICAL

This chapter is a source of truth.

Implementation documents must defer to this chapter.

**19.1 — PRINCIPLES**
Modular, Event-Driven, Signal-Based.

**19.3 — SIGNALS LAYER**
Every subsystem emits events (`asset.risk_detected`, `compliance.expiring`).

**19.17 — NAVIGATION AS A DERIVED SYSTEM**
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