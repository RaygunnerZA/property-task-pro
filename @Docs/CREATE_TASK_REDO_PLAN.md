# CreateTask Redo Plan

## Overview
Plan to redo improvements to CreateTaskModal including AI enhancements, chip behavior definition, vertical section formatting, and design system standardization.

---

## 1. AI IMPROVEMENTS

### 1.1 Enhanced AI Extraction
**Files to modify:**
- `src/hooks/useAIExtract.ts`
- `supabase/functions/ai-extract/index.ts`
- `src/services/ai/ruleBasedExtractor.ts`
- `src/services/ai/chipSuggestionEngine.ts`

**Changes:**
- Improve AI prompt engineering for better entity extraction
- Enhance priority detection accuracy
- Better date/time parsing and normalization
- Improved space/asset matching with fuzzy search
- Enhanced person/team name matching
- Better compliance mode detection
- Add confidence scoring refinement

### 1.2 AI Title Generation
**Files to modify:**
- `src/components/tasks/CreateTaskModal.tsx` (lines 140-143, 490-499)

**Changes:**
- Improve title generation prompt
- Add title quality scoring
- Better capitalization and formatting
- Auto-apply with user override option
- Smooth fade-in animation for AI-generated title

### 1.3 Chip Suggestion Improvements
**Files to modify:**
- `src/hooks/useChipSuggestions.ts`
- `src/services/ai/resolutionPipeline.ts`

**Changes:**
- Better chip scoring algorithm
- Improved ghost category detection
- Enhanced resolution memory system
- Better handling of ambiguous entities
- Improved verb chip detection ("invite", "add", etc.)

---

## 2. CHIP BEHAVIOR DEFINITION

### 2.1 Chip Role Behavior Contracts
**Files to modify:**
- `src/components/chips/Chip.tsx` (already has contracts, verify/enhance)
- `src/components/tasks/create/AISuggestionChips.tsx`
- `src/components/tasks/create/TaskContextRow.tsx`

**Behavior Definitions:**
- **Filter chips**: Toggleable, removable, colorful (property colors OK)
- **Fact chips**: Not toggleable, removable, neutral only, show on hover X
- **Suggestion chips**: Not toggleable, not removable, dotted border, AI glyph, clickable to accept
- **Verb chips**: Not toggleable, not removable, dashed border, orange text, clickable to resolve
- **Status chips**: Not toggleable, not removable, alert color only

### 2.2 Chip Resolution Pipeline
**Files to modify:**
- `src/services/ai/resolutionPipeline.ts`
- `src/components/tasks/CreateTaskModal.tsx` (handleChipSelect function)

**Changes:**
- Define clear resolution flow for verb chips
- Auto-open relevant panel when verb chip clicked
- Better entity matching for resolution
- Ghost entity creation workflow
- Invite chip resolution flow

### 2.3 Chip State Management
**Files to modify:**
- `src/components/tasks/CreateTaskModal.tsx` (appliedChips, selectedChipIds state)

**Changes:**
- Clear separation between fact chips and verb chips
- Proper state updates on chip resolution
- Chip removal handling
- Chip-to-panel navigation mapping

---

## 3. VERTICAL SECTION FORMATTING

### 3.1 Section Layout Structure
**Files to modify:**
- `src/components/tasks/CreateTaskModal.tsx` (lines 1149-1379)

**Current structure:**
```
- Header (modal variant only)
- Scrollable Content:
  - Image Upload
  - AI Title (conditional)
  - Description + Subtasks
  - Task Context Row
  - Context Panels (conditional)
  - Checklist Template
  - Advanced Options
- Footer
```

**Changes:**
- Ensure all sections stack vertically with consistent spacing
- Use `space-y-6` or `space-y-4` for section gaps
- Remove horizontal layouts where not needed
- Ensure proper padding consistency (`p-4` or `px-4 py-3`)
- Add visual separators between major sections if needed

### 3.2 Panel Section Formatting
**Files to modify:**
- `src/components/tasks/create/panels/*.tsx` (all panel components)

**Changes:**
- Standardize vertical spacing within panels
- Consistent label styling
- Uniform input/select heights
- Consistent button placement
- Standardized chip row layouts

### 3.3 Section Visibility & Navigation
**Files to modify:**
- `src/components/tasks/CreateTaskModal.tsx` (activeSection state management)

**Changes:**
- Smooth scroll to active panel
- Clear visual indication of active section
- Proper panel expansion/collapse
- Maintain scroll position when switching sections

---

## 4. BUTTON CORNER RADIUS STANDARDIZATION

### 4.1 Button Component
**Files to modify:**
- `src/components/ui/button.tsx`

**Current:** `rounded-[5px]`
**Target:** `rounded-[8px]`

**Changes:**
- Update base button variant: `rounded-[5px]` → `rounded-[8px]`
- Update size variants (sm, default, lg, icon)
- Ensure all button instances use the component (no inline rounded classes)

### 4.2 Button Usage Audit
**Files to check:**
- `src/components/tasks/CreateTaskModal.tsx`
- All panel components in `src/components/tasks/create/panels/`
- All section components in `src/components/tasks/create/`

**Changes:**
- Replace any inline `rounded-[5px]` with component usage
- Replace any `rounded-xl`, `rounded-lg` with `rounded-[8px]` where appropriate
- Ensure consistency across all buttons in CreateTask flow

### 4.3 Related Components
**Files to check:**
- `src/components/ui/IconButton.tsx`
- `src/components/ui/select.tsx` (SelectTrigger)
- Any custom button-like components

**Changes:**
- Standardize to 8px radius where appropriate
- Maintain design system consistency

---

## 5. FILTERBAR CHIP STYLING

### 5.1 FilterBar Chip Dimensions
**Files to modify:**
- `src/components/ui/filters/FilterBar.tsx` (line 198)
- `src/components/chips/Chip.tsx` (lines 102-104, 113)

**Current FilterBar chips:**
- Height: `h-[35px]`
- Text: `text-[13px]`
- Icon: Default lucide size (varies)

**Target FilterBar chips:**
- Height: `h-[24px]`
- Text: `text-[11px]`
- Icon: `h-[14px] w-[14px]`

**Changes:**
- Update FilterBar renderChip function to pass `h-[24px]` className
- Update Chip component to handle 24px filter chips
- Update text size to `text-[11px]` for filter role chips
- Update icon sizing to `h-[14px] w-[14px]` for filter chips
- Adjust padding to maintain visual balance: `px-2 py-1` or `px-2.5 py-1`

### 5.2 Chip Component Updates
**Files to modify:**
- `src/components/chips/Chip.tsx`

**Changes:**
```typescript
// Update chipHeight logic
const isFilterBarChip = role === 'filter' && (className?.includes('h-[24px]') || className?.includes('w-[24px]'));
const chipHeight = isFilterBarChip ? "h-[24px]" : "h-[24px]"; // Default all to 24px

// Update text size
"font-mono text-[11px] uppercase tracking-wide", // For filter chips
"font-mono text-[13px] uppercase tracking-wide", // For other chips (or keep at 11px for consistency)

// Update icon size in chipContent
{icon && role !== 'suggestion' && role !== 'verb' && (
  <span className="flex-shrink-0">
    {React.cloneElement(icon, { className: "h-[14px] w-[14px]" })}
  </span>
)}
```

### 5.3 FilterBar IconButton Updates
**Files to modify:**
- `src/components/ui/filters/FilterBar.tsx` (renderIconButton, line 214)

**Changes:**
- Update IconButton size from 35 to 24 if used in FilterBar
- Or maintain 35px for icon-only buttons, 24px for chips with icons

### 5.4 Visual Consistency
**Files to check:**
- `src/components/ui/filters/FilterBar.tsx` (all chip rendering)
- `src/components/chips/StandardChip.tsx` (if used in FilterBar)

**Changes:**
- Ensure all FilterBar chips use consistent 24px height
- Verify text readability at 11px
- Test icon visibility at 14x14px
- Adjust spacing/gaps if needed for compact layout

---

## 6. IMPLEMENTATION ORDER

### Phase 1: Design System Standardization
1. ✅ Update Button component corner radius to 8px
2. ✅ Update FilterBar chip styling (24px, 11px text, 14x14px icons)
3. ✅ Audit and fix all button instances in CreateTask flow

### Phase 2: Layout & Formatting
4. ✅ Review and standardize vertical section layout
5. ✅ Ensure consistent spacing and padding
6. ✅ Test panel expansion/collapse behavior

### Phase 3: Chip Behavior
7. ✅ Document and verify chip role contracts
8. ✅ Enhance chip resolution pipeline
9. ✅ Improve verb chip handling
10. ✅ Test chip-to-panel navigation

### Phase 4: AI Improvements
11. ✅ Enhance AI extraction prompts
12. ✅ Improve title generation
13. ✅ Refine chip suggestion scoring
14. ✅ Test end-to-end AI flow

---

## 7. TESTING CHECKLIST

### Design System
- [ ] All buttons have 8px corner radius
- [ ] FilterBar chips are 24px height
- [ ] FilterBar chip text is 11px
- [ ] FilterBar chip icons are 14x14px
- [ ] Visual consistency across all components

### Layout
- [ ] All sections stack vertically
- [ ] Consistent spacing between sections
- [ ] Proper padding on all panels
- [ ] Smooth scrolling to active panels
- [ ] Mobile responsiveness maintained

### Chip Behavior
- [ ] Filter chips toggle correctly
- [ ] Fact chips show remove on hover
- [ ] Suggestion chips accept on click
- [ ] Verb chips open correct panel
- [ ] Chip resolution works end-to-end

### AI
- [ ] AI extraction accuracy improved
- [ ] Title generation quality good
- [ ] Chip suggestions relevant
- [ ] Ghost entities created correctly
- [ ] Resolution memory works

---

## 8. FILES TO MODIFY

### Core Components
- `src/components/ui/button.tsx`
- `src/components/chips/Chip.tsx`
- `src/components/ui/filters/FilterBar.tsx`
- `src/components/tasks/CreateTaskModal.tsx`

### Panel Components
- `src/components/tasks/create/panels/WhoPanel.tsx`
- `src/components/tasks/create/panels/WherePanel.tsx`
- `src/components/tasks/create/panels/WhenPanel.tsx`
- `src/components/tasks/create/panels/PriorityPanel.tsx`
- `src/components/tasks/create/panels/CategoryPanel.tsx`
- `src/components/tasks/create/panels/AssetPanel.tsx`

### Section Components
- `src/components/tasks/create/SubtasksSection.tsx`
- `src/components/tasks/create/ImageUploadSection.tsx`
- `src/components/tasks/create/ThemesSection.tsx`
- `src/components/tasks/create/AssetsSection.tsx`
- `src/components/tasks/create/TaskContextRow.tsx`
- `src/components/tasks/create/AISuggestionChips.tsx`

### AI Services
- `src/hooks/useAIExtract.ts`
- `src/hooks/useChipSuggestions.ts`
- `src/services/ai/ruleBasedExtractor.ts`
- `src/services/ai/chipSuggestionEngine.ts`
- `src/services/ai/resolutionPipeline.ts`
- `supabase/functions/ai-extract/index.ts`

---

## 9. NOTES

- Maintain backward compatibility where possible
- Test on both mobile and desktop
- Ensure accessibility (keyboard navigation, screen readers)
- Keep performance in mind (debouncing, memoization)
- Document any breaking changes
- Update design system documentation if needed
