# TypeScript compiler strictness — status and burn-down

**Purpose:** Track the strict-mode rollout and any remaining suppressed files.

---

## Current status

- **`tsconfig.app.json`** has `"strict": true` enabled (as of engineering remediation pass).
- `tsc -p tsconfig.app.json --noEmit` passes **cleanly with zero errors**.
- No `@ts-nocheck` suppressors were needed — the codebase compiled cleanly on the first pass.
- `"noUnusedLocals"` and `"noUnusedParameters"` remain `false` (next phase — see below).

---

## Remaining work (Phase A continuation)

1. **`noUnusedLocals` / `noUnusedParameters`** — enable and fix fallout. Expected to surface dead
   variables and unused function parameters. Low risk.
2. **`any` burn-down** — `@typescript-eslint/no-explicit-any` is set to `"warn"` in `eslint.config.js`.
   Work through the warnings file-by-file, replacing `any` with proper interfaces. Track in PRs.
3. **CI gate** — add `tsc --noEmit` to the CI pipeline so strict mode regressions are caught at PR time.

---

## Suppressed files

None. If a future PR introduces a `@ts-nocheck` suppressor it must include a reason comment
(enforced by `@typescript-eslint/ban-ts-comment` — `minimumDescriptionLength: 10`).

---

**Revision:** Updated after strict mode was enabled cleanly — zero errors, zero suppressors needed.
