# UI System

Neomorphic design system and UI primitives.

## Design Tokens

- **Primary**: Teal `#8EC9CE`
- **Destructive**: Coral `#EB6834`
- **Shadows**: Use `shadow-sm`, `shadow-md`, `shadow-e1`, `shadow-e2` for depth. No harsh borders.
- **Spacing**: `xs` (4px), `sm` (8px), `md` (12px), `lg` (16px), `xl` (24px) — implemented as CSS variables `--space-*` and mirrored in Tailwind as `p-space-md`, `gap-space-lg`, etc.

### Layout gutters (app-wide)

Use semantic gutters instead of one-off pixel padding:

| Token | CSS variable | Tailwind | Use |
|-------|----------------|----------|-----|
| Page | `--gutter-page` | `px-gutter-page`, `pl-gutter-page` | `StandardPage*`, scope rows, `#root` inset |
| Pane | `--gutter-pane` | `px-gutter-pane` | Dual-pane middle column, aligned 16px surfaces |
| Rail | `--gutter-rail` | `px-gutter-rail` | Dense task rail / tight columns (default 10px; tighten with `max-pane:` where needed) |

### Breakpoints (canonical)

Defined in `src/lib/layoutBreakpoints.ts` and `tailwind.config.ts`:

| Name | Value | Role |
|------|-------|------|
| `max-pane` | max-width 455px | Narrow inner panes — reduce horizontal padding in task UI |
| `md` | 768px (Tailwind) | First desktop step — e.g. dual-pane two-column grid |
| `workspace` | 1100px | Property hub modules — three-column `PropertyWorkspaceLayout` |
| `layout` | 1380px | App shell — dashboard three-column `DualPaneLayout`, property screen right rail |

**Rule of thumb:** dashboard / global shell follows `md` → `layout`. Property documents, compliance, assets, spaces use `workspace` for their three-column grid. Prefer these names over raw `min-w-[…]` in new code.

## Chips

- **Fact chips**: Committed selections (spaces, themes, assignees). Removable.
- **Proposal chips**: Suggested items (ghost chips). Add on press.
- Use `SemanticChip` with `epistemic="fact"` or `epistemic="proposal"`.
- Icon-only rows where appropriate; no Who/Where labels in chip strips.

## Sections

- Flat section style with `shadow-e1` / `shadow-e2`.
- Use `shadow-engraved` for inputs.

## Icons

- `lucide-react` for all icons.
- Asset/entity icons via `ai_icon_search` RPC (semantic lookup).

## Animations

- `animate-fade-in` for transitions.
- Avoid explicit color styling; use theme tokens.
