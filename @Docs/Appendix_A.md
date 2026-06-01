# APPENDIX A — Entity → Context Map


STATUS: CANONICAL

This appendix defines the standard context structure for all primary entities in Filla.

If other documents conflict with this appendix, this appendix is authoritative.

Navigation describes activity.

Entities provide context.

Properties provide scope.

Context panels should reveal entity-specific information without forcing navigation changes.

⸻

PROPERTY

Property represents the primary operational scope.

Context Areas

* Overview
* Operations
* Compliance
* Assets
* People

Overview

Property health, activity, upcoming work, risks and summary metrics.

Operations

Tasks, schedules, inspections, checklists and work execution.

Compliance

Certificates, inspections, obligations, renewals and compliance status.

Assets

Equipment, systems, inventory and linked records.

People

Staff, contractors, suppliers and responsible parties.

⸻

SPACE

Spaces organise operational activity within a property.

Context Areas

* Overview
* Operations
* Assets
* Evidence
* Activity

⸻

ASSET

Assets represent equipment, systems and maintainable items.

Context Areas

* Overview
* Operations
* Maintenance
* Evidence
* Activity

Overview

Asset status, condition and key metadata.

Operations

Open work and operational history.

Maintenance

Service schedules, inspections and maintenance plans.

Evidence

Photos, documents, manuals and warranties.

Activity

Audit history and changes.

⸻

PERSON

People represent staff, contractors, suppliers and contacts.

Context Areas

* Overview
* Responsibilities
* Operations
* Schedule
* Activity

⸻

TASK

Tasks represent coordinated units of work.

Context Areas

* Overview
* Checklist
* Evidence
* Activity

Overview

Description, assignment, status, due dates and operational context.

Checklist

Execution steps, validation requirements and completion progress.

Evidence

Photos, documents, notes, measurements and uploaded proof.

Activity

Audit history, comments, system actions and completion records.

⸻

COMPLIANCE RECORD

Compliance records represent obligations, certificates and inspections.

Context Areas

* Overview
* Evidence
* Schedule
* Activity

⸻

DOCUMENT

Documents represent uploaded records and evidence.

Context Areas

* Overview
* Linked Entities
* Compliance
* Activity

⸻

CONTEXT PANEL PRINCIPLE

Desktop:

Entity context should appear within a context panel whenever practical.

The primary work surface should remain visible.

Mobile:

Entity context may occupy the full screen when necessary.

⸻

CONTEXT HIERARCHY

Property
→ Space
→ Asset
→ Task
→ Evidence

Signals may create or update any level of the hierarchy.

Signals remain infrastructure.

Users primarily interact with tasks, checklists, evidence and records.

The most important changes are:

Property
Overview
Operations
Compliance
Assets
People

instead of:

Property
Overview
Spaces
Assets
Tasks
Compliance
Documents
People
Notes

and

Task
Overview
Checklist
Evidence
Activity

instead of:

Task
Details
Subtasks
Attachments
Timeline

