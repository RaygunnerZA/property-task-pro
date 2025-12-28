# CHAPTER 4 — UI / UX SYSTEM (Tactile Neomorphism)

**4.1 — VISUAL PRINCIPLES**
Tactile Calm, Soft Depth, No Harsh Borders, Material Honesty, No Pure White.

**4.2 — RESPONSIVE LAYOUT STRATEGY**
Filla uses a distinct Desktop vs Mobile paradigm.

**DESKTOP: Dual-Pane Command Centre**
*   **Left Column (Fixed):** Calendar Heatmap + Property Snapshots + Quick Create.
*   **Right Column (Dynamic):** Task Panel (Tabs: Tasks, Inbox, Schedule).
*   **Context Surface:** Clicking a task/property slides a panel over the Right Column. The Left Column stays visible for grounding.

**MOBILE: Single-Pane Adaptive Workflow**
*   **Stack:** Home → Calendar → Task List → Detail View.
*   **Navigation:** Bottom Tab Bar (Home, Tasks, Inbox, Schedule, Create).
*   **Interaction:** Full-screen transitions. Back buttons required.

**4.3 — DESIGN TOKENS (SINGLE SOURCE OF TRUTH)**

All design tokens are defined in:
- **`tailwind.config.ts`** - Colors, shadows, spacing, typography, border radius
- **`src/index.css`** - Utility classes (`.bg-surface-gradient`, `.input-neomorphic`, etc.)

### Color Tokens (HSL)
- **Primary:** `hsl(182, 29%, 63%)` - Teal (#8EC9CE)
- **Accent:** `hsl(16, 83%, 56%)` - Coral (#EB6834)
- **Surface Gradient:** `hsl(40, 15%, 95%)` → `hsl(40, 12%, 93%)` → `hsl(40, 10%, 91%)`
- **Input Background:** `hsl(40, 10%, 96%)`

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
*   **Desktop:** Top Header (Search/User) + Fixed Left Sidebar content.
*   **Mobile:** Bottom Nav Bar + Collapsible Top Calendar.

**4.7 — COMPONENTS**
*   **FAB:** Desktop (Bottom Right Floating) vs Mobile (Center Tab).
*   **Smart Chips:** Desktop (Inline) vs Mobile (Keyboard Drawer).

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
