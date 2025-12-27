# CHAPTER 16 — ASSET MANAGEMENT SYSTEM

**16.1 — PURPOSE**
A living registry of physical things (Boilers, Appliances, Vehicles).

**16.2 — MODEL**
`assets`: type, serial, `condition_score` (0-100).
`asset_evidence`: Linked history.

**16.3 — CAPTURE**
*   **Camera:** AI extracts make/model and detects rust/damage.
*   **Audio:** User narrates the asset condition.

**16.4 — ASSET NAVIGATION**
The Asset Detail Screen defines its own context navigation: Overview, Tasks, Maintenance, History, Documents, Photos, Warranty. These are context surfaces derived from the Asset entity.

**16.13 — AI SIGNALS**
Images generate signals (Rust, Leak). Audio generates signals (Bearing noise). These drive the `condition_score`.