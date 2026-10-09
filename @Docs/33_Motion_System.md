# CHAPTER 33 — FILLA MOTION SYSTEM

STATUS: CANONICAL for motion. Defers to Chapter 4 for visual language, Chapter 19 for signals, Chapter 3 for schema. **Not constitutional** for IA, navigation, tasks, or billing — do not use this chapter to move surfaces or invent actions.

Live references: `/design-library#motion`. Tokens: `src/lib/motion/tokens.ts`. Primitives: `src/components/motion/`. CSS mirrors: `src/index.css` (`--duration-*`, `--ease-*`).

Apply a verb only where this chapter names a recipe. Do not decorate scrolling lists, navigation, or typing.

---

## 33.1 — Purpose

Motion exists to make one transformation legible:

**Information enters Filla → Filla understands it → it connects with existing property knowledge → Filla recommends or takes a user-confirmed action → that knowledge remains useful later.**

If a movement does not report one of those steps, do not animate.

Feel: intelligent, calm, tactile, precise, spatially coherent, slightly physical, premium. Material: **layered cut paper** — abstract, not illustrated. Paper has mass and never bounces.

---

## 33.2 — What motion must never do

- Generic SaaS: fade everything, bounce springs, parallax, glow, gradient “AI”, looping sparkle.
- Delay an action. Buttons and fields are interactive from the first frame.
- Imply an action has already run before the user confirms it. SETTLE is a **proposal at rest**. A pending knowledge node stays dashed and labelled **On save**.
- Replay when the same item is opened again in the same session.
- Animate typing, scrolling, data tables, errors, destructive confirmations, billing, charts, or bulk operations over 5 items.
- Use 3D, Three.js, height/width animation, `transition-all`, or interpolating `box-shadow`.

---

## 33.3 — Six verbs

| Verb | Means | Primitive | Displacement | Scale | Duration | Ease / spring |
|---|---|---|---|---|---|---|
| **LIFT** | This object is active or relevant *now* | `Lift` | y −2px | 1.01 | 280ms visual | `MOTION_SPRING.paper` (`bounce: 0`) |
| **ALIGN** | This information has been connected | `AlignBlock`, `AlignItem` | x −6px → 0; thread `scaleY` 0 → 1 | — | 320ms thread, then 280ms register | paper ease, then paper spring |
| **STACK** | Knowledge or history is accumulating | `SheetStack`, `ResolutionLedger` | new sheet y −4px → 0 | travel condenses to 14×10px | 280ms lay-down; 360ms travel | paper ease |
| **UNFOLD** | Understanding or detail is being revealed | `Unfold` | y 4px; clip `inset(-8px -8px 100% -8px)` → open | — | 320ms | paper |
| **SETTLE** | Filla has reached a decision or state | `Settle`, `SettleValue` | y −2px → 0 | 1.015 → 1 | 280ms | paper |
| **SIGNAL** | Something requires attention | `SignalMark` | tab `scale` 0 → 1 along one edge | — | 200ms out; retracts ~1.6s unless `persist` | out |

Exact numeric tokens live in §33.4. Do not invent a seventh verb.

---

## 33.4 — Tokens

Import from `@/lib/motion/tokens`. CSS names in parentheses.

**Duration (seconds)**

| Token | Value | CSS | Use |
|---|---|---|---|
| `MOTION_DURATION.tap` | 0.12 | `--duration-fast` | press, text swap, content fade before travel |
| `MOTION_DURATION.quick` | 0.20 | `--duration-default` | small state, SIGNAL, hover |
| `MOTION_DURATION.settle` | 0.28 | `--duration-settle` | SETTLE, ALIGN register, sheet lay-down |
| `MOTION_DURATION.reveal` | 0.32 | `--duration-slow` | UNFOLD, thread draw, panel-enter |
| `MOTION_DURATION.travel` | 0.36 | `--duration-travel` | STACK travel to a real destination |

**Easing** — cubic-bezier; never bounce.

| Token | Curve | CSS | Use |
|---|---|---|---|
| `MOTION_EASE.out` | `[0, 0, 0.2, 1]` | `--ease-out` | enter |
| `MOTION_EASE.in` | `[0.4, 0, 1, 1]` | `--ease-in` | exit |
| `MOTION_EASE.inOut` | `[0.4, 0, 0.2, 1]` | `--ease-in-out` | in-place |
| `MOTION_EASE.paper` | `[0.2, 0, 0, 1]` | `--ease-paper` (= `--ease-emphasized`) | SETTLE, UNFOLD, travel |

**Springs** — Framer Motion 12. Always `bounce: 0`.

- `MOTION_SPRING.paper` — `{ type: "spring", visualDuration: 0.28, bounce: 0 }` — chips, rows, LIFT
- `MOTION_SPRING.layer` — `{ type: "spring", visualDuration: 0.36, bounce: 0 }` — layout (FLIP) shifts

**Distance (px)** — `hair` 2, `nudge` 4, `rise` 6, `travel` 16. Nothing moves further than `travel` unless it is going to a **real on-screen destination** (ledger token).

**Scale** — `lift` 1.01, `press` 0.985, `recede` 0.98, `floor` 0.96. Never scale from 0.

**Stagger (seconds)**

- `item` 0.04 (siblings)
- `step` 0.12 (understanding stages)
- `lateStep` 0.08 (stages when content arrives after the intro, e.g. reading finished)
- `maxItems` 6 (later siblings share the last delay)
- `lead` 0.18 (before a sequence, so it layers onto a sheet entrance)
- `MOTION_SEQUENCE_BUDGET` 0.9 — whole intro must finish inside this

Presets: `transitions.tap | quick | settle | reveal | exit`. Delay helper: `staggerDelay(step, index)`.

**Shadow** — `shadow-lift` in `tailwind.config.ts` is a static layer whose **opacity** animates. Never interpolate `box-shadow`.

---

## 33.5 — Sequence rules (understanding)

Wrap one review surface in:

```tsx
<MotionSequence id={`intake-review:${intakeItemId}`}>
  …
</MotionSequence>
```

Stages, always in this order:

0. **Input** — sender, filename, file header  
1. **Facts** — chips, extracted fields, preview  
2. **Interpretation** — summary, ALIGN thread, excerpt  
3. **Decision** — SETTLE recommendation **or** LIFT clarifying question

Rules:

- First view of `id` this session: play intro (`lead` + `staggerDelay`).
- Re-open same `id`: render settled. No replay.
- Content that mounts >150ms after the sequence started (reading finished, new fact) **does** animate — it is new information — on compressed stages (`lateStep` 80ms) so facts still land before the decision.
- Children are never gated on animation completing.
- Reduced motion: `useSequenceEntrance` returns `null`; primitives render still.

`useSequenceEntrance(step, index)` → delay in seconds, or `null` (render settled). Outside a sequence it staggers on mount unless reduced.

---

## 33.6 — Primitives (API recipes)

Import from `@/components/motion`.

### Unfold

```tsx
<Unfold step={1} index={2}>…facts…</Unfold>
```

Occupies full layout immediately (one layout pass). Reveals with clip + 4px rise. After the clip opens, `transitionEnd` sets `clipPath: "none"` so shadows are not cut. `as`: `div` | `li` | `section` | `span`.

### Lift

```tsx
<Lift active={isTheQuestion} step={3} className="rounded-xl bg-muted/30 p-3">
  {question}
</Lift>
```

`active` raises/lowers. Omit `step` to appear already on screen. Depth via a `-z-10 shadow-lift` overlay, not `box-shadow` tween.

### AlignBlock / AlignItem

```tsx
<AlignBlock key={summary} step={2}>{summary}</AlignBlock>
<AlignItem as="span" since={rowMountedAt} className="inline-flex">
  {chip}
</AlignItem>
```

`AlignBlock`: hairline teal thread (`bg-primary/60`) then content registers 6px. Put interpretation **after** facts. `AlignItem`: still if present at first paint; animates when `connected` becomes true or it mounts >150ms after `since` (`performance.now()` of the parent).

### Settle / SettleValue

```tsx
<Settle step={3} radiusClassName="rounded-lg">{primaryAction}</Settle>
<SettleValue value={factDisplay} />
```

SETTLE never means “saved”. `SettleValue` is still on the first value; later values settle in from 4px below (`key={value}`).

### SignalMark

```tsx
<SignalMark tone="attention" edge="left" />           {/* live: processing → ready */}
<SignalMark tone="risk" edge="bottom" persist step={1} /> {/* document needs follow-up */}
```

Parent must be `relative`. `tone`: `attention` (`bg-warning-vivid`) | `risk` (`bg-accent`). `persist` keeps the tab; otherwise it retracts. **Never on page load for items that were already ready.**

### SheetStack

```tsx
<SheetStack arrivals={count} />
```

Three offset sheets. Changing `arrivals` lays a top sheet down.

### MotionSequence

See §33.5. `useFillaReducedMotion()` is the only reduced-motion hook to use in this system.

### ResolvableList / ResolvableItem / ResolutionLedger

```tsx
<ResolutionLedgerProvider>
  <header>
    <h2>Uploads to review</h2>
    <ResolutionLedger className="ml-auto" />
  </header>
  <ResolvableList>
    {items.map((item) => (
      <ResolvableItem key={item.id} id={item.id} scope="intake">
        <div className="relative">
          <span data-resolve-content>…</span>
        </div>
      </ResolvableItem>
    ))}
  </ResolvableList>
</ResolutionLedgerProvider>
```

After a **successful write**, the writer notes the outcome; the exiting row reads it:

```ts
noteResolution("intake", id, "filed", { afterOverlay: true }); // inside a sheet
noteResolution("intake", id, "dismissed");                     // inline ignore
```

Outcomes: `filed` → “On file”; `task` → “Tasks”; `knowledge` → “Knowledge review”; `dismissed` → recedes in place, no destination.

`afterOverlay: true` waits until no `[role=dialog|alertdialog][data-state=open]` remains, plus 220ms for the Radix exit, so the row does not vanish under the modal.

Kept items: inner `[data-resolve-content]` fades, the row condenses to a 14×10 sheet and travels to the ledger token (`layout="position"` on the outer wrapper; imperative motion on an inner div so it does not fight FLIP). Dismissed: opacity 0 + scale 0.98, 200ms ease-in.

If the last row would unmount the host panel, keep the panel mounted until the ledger is idle (`useHoldWhileResolving` in `IntakeInboxPanel`; cap 6s).

### KnowledgeThread

```tsx
<KnowledgeThread
  sequenceId={`${documentLabel}:${assetId}`}
  nodes={buildKnowledgeConnectionNodes({ documentLabel, asset, spaceName, renewal })}
/>
```

Four nodes, in order: **Document → Recognised → On this property → Kept for later**. The last node is always `pending: true` until save: dashed connector + **On save** badge. Builder: `src/lib/intake/knowledgeConnection.ts`. Do not invent a fifth node.

---

## 33.7 — Where it is applied

| Surface | What |
|---|---|
| `IntakeReviewSheet` | Understanding sequence. Facts UNFOLD; `SettleValue` when reading completes; summary ALIGN after facts; SETTLE action or LIFT question. `IntakeDecisionPanel` logic is unchanged. Outcome SIGNAL `risk` only when `briefing.needsFollowUp`. |
| `IntakeInboxPanel` | Resolvable rows + ledger. SIGNAL `attention` when a row goes processing → ready **live**. Inline ignore notes `dismissed`. |
| `IntakeModal` | After `confirmIntakeItem` succeeds: `filed` or `task`, `afterOverlay: true`. |
| `IntakeStaggeredSections` | Row UNFOLD; chips `AlignItem`. |
| `IntakeComplianceScanReview` | `KnowledgeThread` for the primary matched asset. Extra matches stay a text list. |
| Inflow / Issues / My Work | `scope: "inflow"`. Signal cards resolve after a successful action (`attentionOutcomeFromAction`). Ledger on the section. Suggestions recede on dismiss. Scrolling task cards stay still. |
| Create Task | Suggestion chips ALIGN when they appear. Generated title UNFOLDS (no height tween). Create/Cancel SETTLE when the footer is ready. No pulse on “Reading…”. |
| `/design-library#motion` | Grammar strip + three references. Safe to replay. |

Do not invent new destinations. Scrolling task lists, calendars, and nav chrome stay still (existing `panel-enter` only).

---

## 33.8 — Where motion must not be used

- Text fields while the user is typing or editing.
- Scrolling lists, data tables, calendars beyond the existing stamp/panel-enter.
- Navigation chrome, other than the existing `panel-enter`.
- Errors, toasts as celebration, destructive confirmations (they stay still and honest).
- Loading loops, skeleton shimmer as “AI thinking”, sparkle, pulse.
- Revisit / reopen of the same `MotionSequence` id.
- Bulk resolve of more than 5 items — skip travel; tick the ledger count only.
- Anything that would run **before** the user confirms a write.
- Billing, entitlements, charts, reports graphs.
- SIGNAL on first paint of already-ready items.

Do not use `transition-all`. Do not fade whole pages. Do not add `animate-in fade-in duration-700`.

---

## 33.9 — Reduced motion

`prefers-reduced-motion: reduce` → `useFillaReducedMotion()` true.

Then:

- Every primitive renders its **settled** visual. No clip, no travel, no lift, no stagger.
- `SignalMark` without `persist` does not render; with `persist` it is a static tab.
- Resolution: note the outcome, `arrive` on the ledger, `safeToRemove` immediately. Count still updates.
- Sequence ids are still recorded so a later non-reduced session does not surprise-replay.

Never ship a path that ignores the hook.

---

## 33.10 — Performance

- Animate **transform and opacity only**. Clip-path is allowed for UNFOLD (one paint); clear it with `transitionEnd`.
- One layout pass: UNFOLD never animates height. Use `layout="position"` (not full `layout`) on lists.
- Shadows: overlay opacity, never tween `box-shadow`.
- GPU: `will-change` only while moving, if at all. No filters, no blur animation, no scrolling `position: sticky` plus FLIP on the same node.
- Cap stagger at 6 siblings. Whole intro ≤ 900ms.
- Mobile: same verbs, same distances. Do not enlarge travel on small screens.

---

## 33.11 — Honesty and security

- Motion reports what the **deterministic** code already decided (`decideIntake`, matchers, write results). AI output is untrusted copy inside those surfaces; it does not choose an animation, a permission, or a destination.
- `noteResolution` runs only **after** the write succeeds. A missing note means dismissed (recede, no destination) — fail closed.
- Knowledge connection may show a space name from `assets.space_id` → `spaces.name` (documented in Chapter 3). The select is org- and property-scoped under RLS; on error, fall back to the unscoped-by-space asset list and omit the space line. Names are text, never HTML.
- Do not add columns, buckets, or client-supplied org/user ids to make a demo look connected.

---

## 33.12 — Checklist for a new surface

1. Name the transformation in one sentence from §33.1. If you cannot, stop.
2. Pick **one** verb, or one sequence (0–3). Do not combine LIFT + SETTLE + SIGNAL on the same node.
3. Use tokens from `src/lib/motion/tokens.ts`. No magic milliseconds.
4. Use an existing primitive. If you need a new one, add it to `src/components/motion/` and this chapter first.
5. Interactive from frame 0. Confirm writes **then** `noteResolution`.
6. Pending knowledge stays pending in the UI.
7. `MotionSequence` id is stable per entity, not per render.
8. Branch on `useFillaReducedMotion()`.
9. No height animation, no `transition-all`, no bounce.
10. Stop. Do not “while we’re here” animate the rest of the page.

References to re-read before coding: this chapter, `src/components/motion/index.ts`, `/design-library#motion`.
