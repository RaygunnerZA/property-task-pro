# CHAPTER 1 — Overview, Vision & Core Architecture

STATUS: CANONICAL

This chapter is a source of truth.

Implementation documents must defer to this chapter.

## 1. FILLA — PURPOSE, VISION & POSITIONING

Filla is an intelligent operational work execution platform for buildings.

It helps homeowners, property managers, staff and contractors coordinate work, capture evidence, maintain compliance and improve property health.

The platform combines work execution, operational intelligence and property management within a single system.

---

### Core Philosophy

Frontline users complete work.

Managers coordinate outcomes.

Portfolio users manage risk and performance.

Signals, intelligence and automation operate behind the scenes to reduce administrative effort.

The platform should feel simple regardless of the complexity of the underlying system.

---

### Adoption First

The success of Filla depends on frontline adoption.

If cleaners, caretakers, technicians and contractors cannot use the platform with minimal training, the platform has failed regardless of the sophistication of the intelligence layer.

Filla should always optimise for clarity, simplicity and evidence capture before administrative complexity.

---

### Three Core Pillars

#### 1. A Unified Operational Platform

One system for:

- Homeowners
- Property Managers
- Staff
- Contractors

All users operate within the same platform.

Roles determine permissions.

Capabilities determine visibility.

The underlying architecture remains shared.

---

#### 2. Work Execution and Property Health

Filla treats maintenance, inspections and compliance as operational obligations rather than simple reminders.

Tasks, checklists, evidence, schedules and compliance cycles combine to create a living property health timeline.

---

#### 3. Intelligence Without Complexity

AI assists with:

- Capture
- Classification
- Extraction
- Linking
- Compliance detection
- Risk identification

AI never overrides user decisions.

AI proposes.

Humans decide.

---

## 2. FILLA SYSTEM PILLARS

1. Identity & Organisation System
2. Onboarding System
3. Data Model & Supabase Schema
4. RLS, Permissions & Security
5. Information Architecture
6. UI/UX System (Tactile Neomorphism)
7. Task, Checklist & Work Execution System
8. Scheduling & Automation System
9. Compliance Intelligence System
10. AI Architecture
11. Asset Management System
12. Messaging & Collaboration System
13. Analytics & Reporting System
14. Multilingual Copy System
15. Developer Infrastructure

---

## 3. GLOBAL DESIGN ETHOS

Filla is:

- Calm
- Tactile
- Physical
- Trustworthy
- Human

The interface should feel like a workbench rather than a dashboard.

Surfaces should feel paper-based, textured and layered.

The experience should reduce cognitive load rather than increase it.

---

## 4. OPERATIONAL PHILOSOPHY

### Workers Complete Work

Frontline users primarily interact with:

- Tasks
- Checklists
- Evidence
- Completion

They should not be required to understand underlying system complexity.

---

### Managers Manage Outcomes

Managers primarily interact with:

- Open work
- Compliance
- Scheduling
- Property health
- Operational risks

---

### Filla Manages Signals

Signals are platform infrastructure.

Examples:

- Uploaded photos
- Documents
- Emails
- Messages
- Weather alerts
- Compliance detections
- AI observations

Most users should never manage signals directly.

Signals become:

- Tasks
- Records
- Reminders
- Calendar items
- Insights

through the platform.

---

## 5. SYSTEM-WIDE RULES (NON-NEGOTIABLE)

1. Everything is organisation-scoped.
2. Identity determines context.
3. Roles determine permissions.
4. Capabilities determine visibility.
5. Evidence is truth.
6. Schedules generate instances.
7. AI suggests, humans decide.
8. Attachments and evidence are first-class objects.
9. All surfaces follow the tactile design system.
10. Every significant action generates events.
11. Property scope is separate from navigation.
12. Navigation describes activity.
13. Checklists are first-class operational objects.
14. Signals are infrastructure.
15. Data contexts load in strict hierarchy.

---

## 6. ARCHITECTURAL PRINCIPLE

The platform is signal-driven.

The user experience is work-driven.

This distinction should guide all future product, UX and engineering decisions.