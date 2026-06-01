# CHAPTER 5 — TASK, SCHEDULE & AUTOMATIONS SYSTEM

STATUS: CANONICAL

This chapter is a source of truth.

Implementation documents must defer to this chapter.


## 5.1 — PURPOSE

Tasks represent operational work.

Tasks are the primary coordination object.

Checklists are the primary execution object.

Evidence is the primary source of truth.

Most frontline users interact primarily with tasks, checklists and evidence.

---

## 5.2 — TASK MODEL (V3)

A task represents a unit of work.

Examples:

- Fix leak
- Inspect boiler
- Clean apartment
- Conduct fire inspection

### Core

- id
- org_id
- title
- description
- status
  - open
  - in_progress
  - waiting_review
  - completed
  - archived
- priority

### Context

- property_id
- space_ids
- asset_ids

### People

- assigned_user_id
- assigned_team_ids

### Categorisation

- group_ids

Examples:

- Plumbing
- Compliance
- Cleaning
- Maintenance

---

## 5.3 — CHECKLISTS (FIRST-CLASS OBJECTS)

Many operational workflows are checklist-driven.

Examples:

- Fire inspection
- Cleaning routine
- Room turnover
- Weekly building walk
- Boiler service

A task may contain:

- One checklist
- Multiple checklists
- No checklist

depending on the workflow.

---

### Checklist Structure

Checklist items may contain:

- Status
- Notes
- Evidence
- Measurements
- Photos
- Documents
- AI-assisted extraction

Checklist completion should generate audit history automatically.

---

## 5.4 — EVIDENCE MODEL

Evidence represents proof of work.

Examples:

- Photos
- Videos
- Documents
- Audio recordings
- Measurements
- Notes

Evidence is considered more authoritative than manually entered summaries.

---

### Evidence Relationships

Evidence may be attached to:

- Tasks
- Checklist Items
- Assets
- Properties
- Compliance Records

---

## 5.5 — TASK DETAIL EXPERIENCE

### Desktop

Task detail opens in a contextual side panel.

The work surface remains visible.

The user should not lose operational context.

---

### Mobile

Task detail becomes a dedicated full-screen workflow.

Mobile should prioritise:

- Checklist completion
- Evidence capture
- Issue reporting
- Completion

over administrative actions.

---

## 5.6 — TASK CONTEXT AREAS

Task detail should be organised around execution.

Recommended structure:

### Overview

- Description
- Assignment
- Status
- Due dates

### Checklist

- Checklist items
- Progress
- Validation

### Evidence

- Photos
- Documents
- Notes
- Audio

### Activity

- Audit history
- Status changes
- Comments
- System actions

Messaging should appear within context rather than as a standalone communication domain.

---

## 5.7 — SIGNAL GENERATION

Tasks and checklist activity may generate signals.

Examples:

- Fire extinguisher expiry detected
- Boiler serial number recognised
- Compliance document identified
- Weather-related risk detected

Signals are infrastructure.

Most users should not interact directly with signals.

---

### Signal Outcomes

Signals may create:

- Reminder tasks
- Compliance records
- Asset updates
- Review requests
- Manager notifications
- Insights

subject to review rules and permissions.

---

## 5.8 — AUTOMATIONS

Automations should reduce administrative work.

Examples:

- Generate recurring inspections
- Create reminder tasks
- Route work to teams
- Link evidence to assets
- Update compliance schedules

AI should propose actions.

Humans remain responsible for approval where required.

---

## 5.9 — LOGS & AUDIT

Every significant action writes to audit_logs.

Examples:

- Status changes
- Assignment changes
- Checklist completion
- Evidence uploads
- Signal generation
- Review decisions

Audit history should be reconstructable at any point.

---

## 5.10 — OPERATIONAL FLOW

The preferred operational model is:

Signal
→ Task

Task
→ Checklist

Checklist
→ Evidence

Evidence
→ Record

Record
→ Insight

This workflow should guide task, checklist and automation design throughout Filla.