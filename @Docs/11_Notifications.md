# CHAPTER 11 — NOTIFICATION & DELIVERY ENGINE

**11.1 — PRINCIPLE**
Notifications are projections of platform signals. They are identity-aware and org-scoped.

**11.2 — SIGNAL FLOW**
Platform Signal (`task.overdue`) → Notification Engine → Routing Rules → Delivery.

**11.4 — ROUTING**
*   **Staff:** Only for assigned properties.
*   **Contractor Free:** Only for job scope.
*   **Manager:** Threshold-based escalations.

**11.6 — CHANNELS**
In-app (Guaranteed), Email (Best-effort), Push (Future).