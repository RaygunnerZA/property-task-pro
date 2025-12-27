# CHAPTER 13 — MESSAGING SYSTEM

**13.1 — TYPES**
Task Conversation, Property Thread, Compliance Review, Contractor Job Thread.

**13.3 — DATA MODEL**
`conversations` (org_id, type, parent_id), `messages` (text, audio, attachment).

**13.4 — AUDIO**
Audio messages include a waveform and an auto-generated AI summary bubble.

**13.8.1 — NAVIGATION CONTEXT**
Messages do not exist as a standalone navigation domain. Messaging appears within entity contexts (Property, Task) or the Action Layer.