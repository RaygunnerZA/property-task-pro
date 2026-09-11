# CHAPTER 4 — UI / UX SYSTEM (Tactile Neomorphism)

STATUS: CANONICAL

This chapter is a source of truth.

Implementation documents must defer to this chapter.


**4.1 — VISUAL PRINCIPLES**
Tactile Calm, Soft Depth, No Harsh Borders, Material Honesty, No Pure White.

**4.2 — RESPONSIVE LAYOUT STRATEGY**

Filla uses a distinct Desktop vs Mobile paradigm while maintaining the same underlying platform.

The goal is progressive complexity:

* Frontline users complete work.
* Managers coordinate work.
* Portfolio users review outcomes and intelligence.

The underlying system remains the same.

⸻

DESKTOP: Operational Workbench

Desktop is optimised for coordination, planning and review.

Left Column (Grounding & Scope)

Contains:

* Property Scope Selector
* Mini Calendar
* Property Snapshots
* Quick Create
* Personal Overview

This column remains visible whenever possible to provide grounding.

⸻

Centre Column (Primary Work Surface)

Contains the user’s current activity area.

Examples:

* Home (Inflow)
* Tasks · Calendar · Records (primary workspace)
* Property (Spaces · Assets · People)
* Reports

This is the primary focus area.

⸻

**Home & Primary Workspace Decision (V2.2)**

Filla separates **signal intake** (Home / Inflow) from **work execution** (Tasks · Calendar · Records) and **place entities** (Property).

**Home (Inflow)**

Home is the standalone homepage. Route: `/`.

*Purpose:* Review signals, suggestions, and items waiting for a decision.

*Content:* Needs review · Found signals · Suggested tasks · Records to organise.

Home has **no** Tasks · Calendar · Records tab strip. Left column keeps property / portfolio context and suggested actions; the expandable mini-calendar is **not** on Home.

Inflow is **signal-driven**.

**Primary workspace — Tasks · Calendar · Records**

The primary operational workspace for staff, technicians, caretakers and contractors.

| Tab | Route | Purpose |
|-----|-------|---------|
| Tasks | `/tasks` | Execute work — overdue, today, assigned, completed |
| Calendar | `/calendar` | Month grid and day schedule for planned work |
| Records | `/records` | Evidence, certificates, documents, compliance artefacts |

Centre tabs **Tasks · Calendar · Records** are the titles of this workspace. Task cards prioritise checklist progress, evidence status, property/location context, and due urgency.

Tasks is **work-driven**. Records is **evidence-driven**.

**Property activity area — Spaces · Assets · People**

Property is an **activity area for place entities**, not a duplicate task tree.

| Tab | Route | Purpose |
|-----|-------|---------|
| Spaces | `/property/spaces` | Spaces and space groups |
| Assets | `/property/assets` | Equipment and maintainable items |
| People | `/property/people` | Staff, contractors, suppliers, contacts (outside Settings) |

Left-nav **Property**:
* Single property: opens Spaces for the current scope.
* Multiple properties: hover expands a property list; click a property sets scope and opens Spaces; click Property itself opens Spaces for the current scope.

**Add Property** is a secondary tab on the Create Space action panel (not a primary nav item).

**Tags** are not a primary nav item. A compact **Manage Tags** panel sits below action panels on Spaces, Assets, and People, explaining how tags (including Teams-as-tags) assist that surface.

**Filla Admin** (orgs, utilisation, AI, Knowledge) and **Dev Tools** are platform-admin only and do **not** appear on user navigation.

Platform flow: Signal → Task → Checklist → Evidence → Record → Insight

**Desktop — Home**

| Column | Role |
|--------|------|
| Left | Scope + property / portfolio context (no mini-calendar) |
| Centre | **Inflow** |
| Right | Context / intake as needed |

**Desktop — Primary workspace (Tasks · Calendar · Records)**

| Column | Role |
|--------|------|
| Left | Title image block (160px) · section health tabs (no radial) · perforation · expandable calendar (Tasks & Records only, collapsed by default) · ≤3 suggested actions · Recent |
| Centre | Tasks · Calendar · Records + page content |
| Right | Create Task / Add Record / relevant detail (≥1280px) |

**Desktop — Property (Spaces · Assets · People)**

| Column | Role |
|--------|------|
| Left | Title image block (160px) · section health tabs (no radial) · perforation · ≤3 suggested · Recent (spaces / assets / people / contractors / teams) |
| Centre | Spaces · Assets · People · sub-tabs · collection slider · filter/sort · lists |
| Right | Create Space / Add Asset / Invite Member · Manage Tags below |

**Mobile**

Primary destinations: Home, Tasks, Calendar / Records as capacity allows. Property entity surfaces remain available; complex coordination may defer to desktop.

**Gradient header (all primary screens)**

At middle widths (no third column), **Create Task** and **Add Record** live in the gradient header between Search and Profile — consistent across Home, workspace, and Property screens.

**Properties (scope)**

Properties remain a **scope** mechanism. Property selection filters Home, Tasks, Calendar, Records, and Property entity lists. It does **not** create `Property → {name} → Tasks` navigation trees.

⸻

Right Column (Context & Detail)

Contains contextual information related to the selected object.

Examples:

* Task Detail
* Checklist Progress
* Asset Information
* Property Overview
* Compliance Detail

Detail panels should not replace the primary work surface.

Where possible they should slide over or coexist with the centre column.

⸻

MOBILE: Work Execution First

Mobile is optimised for:

* Completing work
* Completing checklists
* Capturing evidence
* Reporting issues

Complex coordination workflows should be deferred to desktop where appropriate.

⸻

MOBILE STRUCTURE

Primary flows:

* Home (Inflow)
* Tasks
* Calendar / Records
* Report Issue

Additional activity areas (Property, Reports) may appear depending on role and permissions.

All mobile interactions should favour:

* Full-screen focus
* Bottom sheets
* Camera-first workflows
* Minimal data entry

⸻

SCOPE

Property selection represents scope.

Examples:

* All Properties
* The Bird
* Pelican House

Changing scope filters content across activity areas.

The left-nav **Property** item opens the Property activity area (Spaces · Assets · People). Hover-listing properties for multi-property orgs sets **scope** then opens Spaces — it must not nest Tasks under each property.

Scope must not create duplicate task navigation structures.

Bad:

Property
→ The Bird
→ Tasks

Good:

Tasks
filtered by:
The Bird

and separately:

Property → Spaces
filtered by:
The Bird

⸻

PROGRESSIVE COMPLEXITY

Frontline users should see a simplified version of the platform.

Managers should see broader operational context.

Portfolio users should see reporting and intelligence.

The platform should reveal complexity gradually rather than through separate products.

⸻
**4.3 — DESIGN TOKENS (SINGLE SOURCE OF TRUTH)**

All design tokens are defined in:
- **`tailwind.config.ts`** - Colors, shadows, spacing, typography, border radius
- **`src/index.css`** - Utility classes (`.bg-surface-gradient`, `.input-neomorphic`, etc.)

### Color Tokens (HSL)
- **Primary:** `hsl(185, 40%, 68%)` - Teal (#8EC9CE)
- **Primary Foreground:** `hsl(248, 15%, 18%)` - Ink. Text on teal fills is ink, never white: white on #8EC9CE is ~1.8:1 contrast (fails WCAG AA); ink is ~7.7:1.
- **Accent:** `hsl(16, 83%, 56%)` - Coral (#EB6834)
- **Card / Popover:** `hsl(40, 20%, 98%)` - Warm paper (#FBFAF8). Cards are never pure white (§4.1 "No Pure White").
- **Surface Gradient:** `hsl(40, 15%, 95%)` → `hsl(40, 12%, 93%)` → `hsl(40, 10%, 91%)`
- **Input Background:** `hsl(40, 10%, 96%)`

### Typography Tokens
- **Families:** `font-sans` — Inter Tight (UI body); `font-display` — Fraunces (property names, main screen H1s); `font-mono` — JetBrains Mono (metadata, badges, stats).
- **Scale (max 8 sizes):** `text-2xs` (10px, tracking baked in — signature mono metadata size) · `text-caption` (11px) · `text-xs` (12) · `text-sm` (14) · `text-base` (16) · `text-lg` (18) · `text-xl` (20) · `text-2xl` (24). Do not use arbitrary `text-[Npx]` values.
- **Caps rule:** uppercase mono labels need positive tracking. Prefer `text-2xs` / `text-caption` (tracking baked in). For filter chips and other multi-word caps labels, use `tracking-wide` — do not stack `tracking-wider` on those sizes (it over-spaces word gaps, e.g. "MY TASKS"). Single-word badges may use `tracking-wider`.
- **Numerals:** stats and tables use `tabular-nums` (or `data-stat` attribute).
- **Headings:** `h1`–`h3` get `text-wrap: balance` globally.
- **Progress copy:** always ends with a proper ellipsis character ("Loading…", never "Loading...").

### Shadow Tokens
- **`shadow-e1`** - Flat card with texture overlay
- **`shadow-e2`** - Flat section style
- **`shadow-e3`** - Floating modals/popovers
- **`shadow-engraved`** - Inset/debossed inputs
- **`shadow-primary-btn`** - Primary button shadow
- **`shadow-btn-pressed`** - Pressed button state
- **`shadow-fab`** - Floating action button

### Utility Classes
- **`.bg-surface-gradient`** - Surface gradient background
- **`.bg-input`** - Input background color
- **`.input-neomorphic`** - Neomorphic input styling
- **`.btn-neomorphic`** - Neomorphic button styling
- **`.btn-accent-vibrant`** - Vibrant accent button
- **`.icon-primary`** - Primary color for icons

**4.3b — ACTIVITY-AREA CHROME & LEFT-COLUMN FORMULA (desktop workbench)**

**Primary chrome (Home, Tasks · Calendar · Records, Property):** Filla logo top-left; Search on the gradient; **Create Task** / **Add Record** between Search and Profile at middle widths; account avatar top-right. Settings is **not** in the left nav rail.

**Left column — Home (Inflow):** property / portfolio context + suggested actions; **no** expandable mini-calendar.

**Left column — Tasks · Calendar · Records and Property (Spaces · Assets · People), top to bottom:**

1. **Title image block** (~160px) — H1 (`font-display` / Fraunces) + short description on imagery
2. **Section health dashboard** — three informational tabs styled like the Inflow property card stats (**omit** the radial completion graph)
3. **Perforation** line
4. **Expandable calendar** — **Tasks** and **Records** only; **collapsed by default**. Omitted on **Calendar** (centre owns the calendar) and on Property / Home
5. **Filla suggested actions** — up to 3
6. **Recent** — compact list of recent task activity / messages / events / records (workspace) or spaces / assets / people / contractors / teams (Property)

**Centre — Property:** Spaces · Assets · People tabs → perforation → page sub-tabs → collection slider (no collection title/description above; match Spaces Groups / Records slider patterns for Assets and People) → filter bar + sort → responsive lists.

**Reports / Settings / Knowledge (admin):** may retain Back + activity header variants as needed. Knowledge is under **Filla Admin**, not user nav.

Placeholder pattern: `Ask about {Topic} or anything else.` (opens Ask Filla on submit; `onChange` may also filter the page). Pressed search fields carry the Filla AI icon on the left.

**4.4 — REUSABLE COMPONENTS**

All reusable components are in **`src/components/design-system/`**:

### StandardPage
Complete standardized page layout with header, content area, and optional bottom navigation.

```tsx
import { StandardPage } from "@/components/design-system/StandardPage";
import { NeomorphicButton } from "@/components/design-system/NeomorphicButton";
import { Plus, Shield } from "lucide-react";

<StandardPage
  title="Compliance"
  subtitle="12 documents"
  icon={<Shield className="h-6 w-6" />}
  action={
    <NeomorphicButton onClick={handleAdd}>
      <Plus className="h-4 w-4 mr-2" />
      Upload Document
    </NeomorphicButton>
  }
  maxWidth="md"
  showBottomNav={true}
>
  {/* Page content */}
</StandardPage>
```

**Props:**
- `title` (required): Main page title
- `subtitle` (optional): Secondary text below title
- `icon` (optional): Icon displayed next to title (gets primary color automatically)
- `action` (optional): Action button/component in header
- `maxWidth`: `"sm"` (mobile), `"md"` (default), `"lg"`, `"xl"`, `"full"`
- `showBottomNav`: Show/hide bottom navigation (default: `true`)

### StandardPageWithBack
Variant of StandardPage with back button navigation.

```tsx
<StandardPageWithBack
  title="Property Detail"
  subtitle="123 Main St"
  backTo="/properties"
  icon={<Building2 className="h-6 w-6" />}
>
  {/* Content */}
</StandardPageWithBack>
```

### NeomorphicInput
Neomorphic-styled input component.

```tsx
import { NeomorphicInput } from "@/components/design-system/NeomorphicInput";

<NeomorphicInput
  placeholder="Enter text..."
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
```

### NeomorphicButton
Neomorphic-styled button component.

```tsx
import { NeomorphicButton } from "@/components/design-system/NeomorphicButton";

<NeomorphicButton onClick={handleClick}>
  <Plus className="h-4 w-4 mr-2" />
  Add Item
</NeomorphicButton>
```

### CardButton
Standardized button for icons on cards (chevrons, close buttons, etc.). Normal state matches card background with no neumorphic effect. Hover state shows pressed neumorphic effect.

```tsx
import { CardButton } from "@/components/design-system/CardButton";
import { ChevronLeft, X } from "lucide-react";

// Navigation button
<CardButton aria-label="Previous month">
  <ChevronLeft className="h-6 w-6" />
</CardButton>

// Close button
<CardButton aria-label="Close">
  <X className="h-6 w-6" />
</CardButton>
```

**Props:**
- All standard button HTML attributes
- `aria-label` (required for accessibility)
- Children should be the icon component

### EmptyState
Standardized empty state component.

```tsx
import { EmptyState } from "@/components/design-system/EmptyState";
import { Home, Plus } from "lucide-react";

<EmptyState
  icon={Home}
  title="No properties yet"
  description="Add your first property to get started"
  action={{
    label: "Add Property",
    onClick: () => setShowAdd(true),
    icon: Plus
  }}
/>
```

### LoadingState
Standardized loading state component.

```tsx
import { LoadingState } from "@/components/design-system/LoadingState";

<LoadingState message="Loading properties..." />
```

### ErrorState
Standardized error state component with optional retry.

```tsx
import { ErrorState } from "@/components/design-system/ErrorState";

<ErrorState 
  message="Failed to load properties"
  onRetry={() => refresh()}
/>
```

**4.5 — MIGRATION GUIDE**

### Replacing Hardcoded Values

**Gradients:**
- `bg-gradient-to-br from-[#F4F3F0] via-[#F2F1ED] to-[#EFEDE9]` → `bg-surface-gradient`

**Input Backgrounds:**
- `bg-[#F6F4F2]` → `bg-input`

**Input Styles:**
- Inline neomorphic styles → `input-neomorphic` class

**Button Styles:**
- Inline neomorphic button styles → `btn-neomorphic` class
- Vibrant accent buttons → `btn-accent-vibrant` class

**Headers:**
- Hardcoded header styles → `<StandardPage>` or `<StandardPageWithBack>` component

**Badges:**
- `bg-red-500/10 text-red-700` → `<Badge variant="danger">`
- `bg-amber-500/10 text-amber-700` → `<Badge variant="warning">`
- `bg-green-500/10 text-green-700` → `<Badge variant="success">`

**Icon Colors:**
- `text-[#8EC9CE]` → `text-primary` or `icon-primary` class
- `text-[#EB6834]` → `text-accent`

**Focus Rings:**
- `focus:ring-[#0EA5E9]/30` → `focus:ring-primary/30`

### Migrating from Old Filla Components

**Deprecated Components (Use Design System Equivalents):**
- `Surface` → Use `Card` from shadcn or design system
- `Heading` → Use standard HTML headings with design system classes
- `Text` → Use standard HTML elements with design system classes
- `Button` (from filla) → Use `NeomorphicButton` or shadcn `Button`
- `Input` (from filla) → Use `NeomorphicInput` or shadcn `Input`
- `Badge` (from filla) → Use shadcn `Badge` with variants
- `Typography` → Use design system typography classes

**Still-Used Components (Keep but update to use design tokens):**
- `SegmentControl` / `SegmentedControl` - Used in WorkTasks
- `MiniCalendar` - Used in Calendar page
- `TaskCard` - Check usage
- `DashboardTabs` - Check usage

**4.6 — NAVIGATION PATTERNS**
Navigation describes activity.

Scope describes context.

Roles determine visibility.

These concepts must remain separate.

⸻

ACTIVITY AREAS

User left navigation (desktop), in order:

* Home
* — separator —
* Tasks
* Calendar
* Records
* — separator —
* Property
* Reports

**Filla Admin** (The Org, utilisation, AI, Knowledge) and **Dev Tools** are platform-only and never appear on user nav.

Not every role sees every activity area.

Navigation should remain as consistent as possible across user types.

⸻

PROPERTY SCOPE

Properties are a scope mechanism. The **Property** activity area manages place entities (Spaces · Assets · People) under that scope.

Property selection filters all activity areas.

Property selection must never create duplicate **task** navigation trees (e.g. Property → {name} → Tasks). Hover-to-list properties only sets scope and opens the Property activity area.

⸻

CONTEXT SURFACES

Selecting an entity should reveal context.

Examples:

* Task
* Asset
* Property
* Compliance Record
* Document

Context surfaces provide detail without forcing navigation changes.

⸻

ROLE VISIBILITY

Roles determine which activity areas are visible.

Examples:

Cleaner:

* Home
* Tasks
* Calendar

Property Manager:

* Home
* Tasks
* Calendar
* Records
* Property
* Reports

Portfolio Manager:

* Home
* Property
* Reports
* Intelligence

Platform admin (separate shell):

* Filla Admin (orgs, utilisation, AI, Knowledge)
* Dev Tools

The platform remains the same.

**4.7 — COMPONENTS**

Floating Action Button (FAB)

Represents the fastest path to creating work.

Examples:

* Report Issue
* Create Task
* Add Evidence
* Upload Document

Desktop:

* Floating bottom-right action

Mobile:

* Floating action button or central action entry point

⸻

Smart Chips

Represent lightweight suggestions and actions.

Examples:

* Property suggestions
* Asset suggestions
* AI recommendations
* Checklist shortcuts

Smart chips should assist users without interrupting workflows.

AI should appear as guidance, not as a dominant interface element.

⸻

Context Panels

Context panels are a core Filla interaction pattern.

Examples:

* Task Detail
* Asset Detail
* Property Overview
* Compliance Detail

Panels should provide context without removing the user from their current activity.

The work surface should remain visible whenever practical.

**4.8 — MIGRATION CHECKLIST**

When migrating a page, ensure:

- [ ] Uses `StandardPage` or `StandardPageWithBack` component
- [ ] All gradients use `bg-surface-gradient`
- [ ] All inputs use `input-neomorphic` or `<NeomorphicInput>`
- [ ] All buttons use `btn-neomorphic` or `<NeomorphicButton>`
- [ ] All badges use semantic variants from shadcn `Badge`
- [ ] All colors use semantic tokens (no hardcoded hex values)
- [ ] Icons use `icon-primary` class for primary color
- [ ] Consistent spacing throughout
- [ ] Loading and error states use `LoadingState` and `ErrorState`
- [ ] Empty states use `EmptyState` component
- [ ] No manual `<BottomNav />` includes (handled by StandardPage)
