# Design System Components

This directory contains reusable design system components that ensure consistency across the application.

## Components

### StandardPage
A complete page layout component that provides:
- Standardized header with title, subtitle, icon, and action
- Consistent max-width containers
- Optional bottom navigation
- Design system compliant styling

**Usage:**
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
>
  {/* Page content */}
</StandardPage>
```

### PageHeader
A standardized header component for pages that need custom layouts.

**Usage:**
```tsx
import { PageHeader } from "@/components/design-system/PageHeader";

<PageHeader>
  <div className="max-w-7xl mx-auto px-4 py-4">
    <h1>Page Title</h1>
  </div>
</PageHeader>
```

### NeomorphicInput
A neomorphic-styled input component that follows design system standards.

**Usage:**
```tsx
import { NeomorphicInput } from "@/components/design-system/NeomorphicInput";

<NeomorphicInput
  placeholder="Enter text..."
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>
```

### NeomorphicButton
A neomorphic-styled button component that follows design system standards.

**Usage:**
```tsx
import { NeomorphicButton } from "@/components/design-system/NeomorphicButton";

<NeomorphicButton onClick={handleClick}>
  <Plus className="h-4 w-4 mr-2" />
  Add Item
</NeomorphicButton>
```

### EmptyState
A standardized empty state component for when there's no data to display.

**Usage:**
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
A standardized loading state component.

**Usage:**
```tsx
import { LoadingState } from "@/components/design-system/LoadingState";

<LoadingState message="Loading properties..." />
```

### ErrorState
A standardized error state component with optional retry functionality.

**Usage:**
```tsx
import { ErrorState } from "@/components/design-system/ErrorState";

<ErrorState 
  message="Failed to load properties"
  onRetry={() => refresh()}
/>
```

## Migration Guide

When migrating existing pages to use these components:

1. **Replace custom headers** with `StandardPage` or `PageHeader`
2. **Replace hardcoded gradients** with `bg-surface-gradient`
3. **Replace custom inputs** with `NeomorphicInput`
4. **Replace custom buttons** with `NeomorphicButton`
5. **Use semantic color tokens** instead of hardcoded hex values

See `DESIGN_SYSTEM_MIGRATION.md` for detailed migration patterns.

