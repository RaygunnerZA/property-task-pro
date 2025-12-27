# CHAPTER 19 — PLATFORM ARCHITECTURE

**19.1 — PRINCIPLES**
Modular, Event-Driven, Signal-Based.

**19.3 — SIGNALS LAYER**
Every subsystem emits events (`asset.risk_detected`, `compliance.expiring`).

**19.17 — NAVIGATION AS A DERIVED SYSTEM**
Navigation is not a stored structure. It is derived at runtime from `entity_type`, `identity`, and `permissions`. No module may assume the existence of a global menu.