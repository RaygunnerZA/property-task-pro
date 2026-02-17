# UI System

Neomorphic design system and UI primitives.

## Design Tokens

- **Primary**: Teal `#8EC9CE`
- **Destructive**: Coral `#EB6834`
- **Shadows**: Use `shadow-sm`, `shadow-md`, `shadow-e1`, `shadow-e2` for depth. No harsh borders.
- **Spacing**: `xs` (4px), `sm` (8px), `md` (12px), `lg` (16px), `xl` (24px)

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
