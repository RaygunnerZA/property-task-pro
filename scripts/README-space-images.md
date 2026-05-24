# Space illustration PNG pipeline

## Layout

| Path | Purpose |
|------|---------|
| `public/spaces/_incoming/` | Raw uploads (numeric names from export) |
| `public/spaces/mini-cards/` | Renamed illustrations for `SpaceCard` banners |
| `public/spaces/_manifest.json` | Source → target mapping, confidence, suggested uses |
| `public/spaces/_classification_cache.json` | Resumable vision labels (OpenAI or manual) |
| `src/lib/spaceTypeIllustrations.ts` | Auto-generated slug → URL map |

## Rename script

```bash
pip install openai
export OPENAI_API_KEY=sk-...

# Preview
python3 scripts/rename_space_images.py --dry-run

# Apply (copies to mini-cards/, writes manifest + illustrations TS)
python3 scripts/rename_space_images.py --apply

# Re-apply from existing cache (no API)
python3 scripts/rename_space_images.py --cache-only --apply
```

**Safety:** Never overwrites an existing file with different content — uses `-2`, `-3`, … suffixes instead.

## Initial import (May 2026)

119 PNGs from `Images/Spaces.zip` classified via vision agents, applied with `--cache-only --apply`.

Unused / alternate assets (`*-2.png`, safety signage, abstract art) — see `_manifest.json` → `suggestedUsesForUnused` and per-file `suggestedUse`.
