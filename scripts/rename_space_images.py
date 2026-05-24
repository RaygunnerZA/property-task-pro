#!/usr/bin/env python3
"""
Classify space PNG illustrations with GPT-4o-mini vision and rename safely.

Usage:
  pip install openai
  export OPENAI_API_KEY=sk-...
  python scripts/rename_space_images.py --dry-run
  python scripts/rename_space_images.py --apply
  python scripts/rename_space_images.py --apply --limit 5   # smoke test

Reads:  public/spaces/_incoming/*.png
Writes: public/spaces/mini-cards/<slug>.png (never overwrites; uses -2, -3, …)
        public/spaces/_manifest.json
        public/spaces/_classification_cache.json (resumable)
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import re
import shutil
import sys
import time
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
MIGRATION = REPO_ROOT / "supabase/migrations/20260230000000_add_space_type_default_icon.sql"
INCOMING = REPO_ROOT / "public/spaces/_incoming"
OUT_DIR = REPO_ROOT / "public/spaces/mini-cards"
MANIFEST_PATH = REPO_ROOT / "public/spaces/_manifest.json"
CACHE_PATH = REPO_ROOT / "public/spaces/_classification_cache.json"
ILLUSTRATIONS_TS = REPO_ROOT / "src/lib/spaceTypeIllustrations.ts"

GROUP_HINTS: dict[str, list[str]] = {
    "circulation": ["Corridor", "Hallway", "Staircase", "Lobby", "Entrance", "Landing", "Exit", "Fire Escape"],
    "habitable": ["Living Room", "Bedroom", "Office", "Kitchen", "Meeting Room", "Sales Floor", "Dining Room", "Home Office", "Study", "Open Plan Office", "Conference Room", "Boardroom", "Retail Floor", "Classroom", "Library", "Training Room"],
    "service": ["Kitchen", "Break Room", "Utility Room", "Staff Room", "Pantry", "Canteen", "Staff Kitchen", "Breakout Area", "Print Room", "Copy Room"],
    "sanitary": ["Bathroom", "WC", "Shower Room", "Shower Block", "Changing Room", "Toilet", "Accessible WC", "Locker Room"],
    "storage": ["Storage Room", "Closet", "Cupboard", "Archive", "Stock Room", "Archive Room"],
    "technical": ["Server Room", "Plant Room", "Electrical Room", "Boiler Room", "HVAC Room", "IT Room", "Comms Room", "Generator Room", "UPS Room", "Lift Motor Room", "Rooftop Plant", "Mechanical Room"],
    "external": ["Garden", "Terrace", "Car Park", "Loading Bay", "Yard", "Roof", "Balcony", "Courtyard", "Parking", "Bike Store", "Bin Store"],
}


def load_dotenv(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


def slugify(name: str) -> str:
    s = name.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "unknown"


def parse_space_types() -> list[str]:
    text = MIGRATION.read_text(encoding="utf-8")
    names = re.findall(r"WHERE name = '([^']+)'", text)
    extra = ["Mechanical Room", "Shower", "Utility Room", "Reception"]
    seen: set[str] = set()
    out: list[str] = []
    for n in names + extra:
        if n not in seen:
            seen.add(n)
            out.append(n)
    return sorted(out)


def file_hash(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


def load_cache() -> dict[str, Any]:
    if CACHE_PATH.is_file():
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    return {}


def save_cache(cache: dict[str, Any]) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(cache, indent=2), encoding="utf-8")


def classify_image(client: Any, path: Path, space_types: list[str]) -> dict[str, Any]:
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    types_block = "\n".join(f"- {t}" for t in space_types)
    prompt = f"""You classify property interior/exterior space illustrations for a facilities app.

Pick the SINGLE best match from this exact list (copy spelling exactly):
{types_block}

If nothing fits well, set canonical_name to null and describe in free_label.

Return JSON only:
{{
  "canonical_name": "Kitchen" | null,
  "free_label": "short description if unlisted",
  "confidence": 0.0 to 1.0,
  "visual_summary": "one sentence"
}}"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{data}", "detail": "low"}},
                ],
            }
        ],
        max_tokens=200,
        temperature=0.1,
        response_format={"type": "json_object"},
    )
    raw = response.choices[0].message.content or "{}"
    return json.loads(raw)


def pick_unique_target(base_slug: str, src: Path, reserved: dict[str, str]) -> tuple[str, str]:
    """Return (filename, reason). Never overwrite different content."""
    ext = src.suffix.lower()
    digest = file_hash(src)
    candidate = f"{base_slug}{ext}"
    target = OUT_DIR / candidate

    if candidate not in reserved:
        if not target.exists():
            return candidate, "new"
        if file_hash(target) == digest:
            return candidate, "identical_skip"
        reserved[candidate] = digest

    n = 2
    while True:
        candidate = f"{base_slug}-{n}{ext}"
        target = OUT_DIR / candidate
        if candidate not in reserved:
            if not target.exists():
                return candidate, f"collision_suffix_{n}"
            if file_hash(target) == digest:
                return candidate, "identical_skip"
            reserved[candidate] = file_hash(target)
        n += 1
        if n > 99:
            raise RuntimeError(f"Too many collisions for slug {base_slug}")


def suggest_alternate_use(entry: dict[str, Any]) -> str | None:
    name = entry.get("spaceType") or entry.get("freeLabel")
    if not name:
        return "Empty state / onboarding placeholder"
    for group_id, types in GROUP_HINTS.items():
        if entry.get("spaceType") in types:
            return f"Space group hero ({group_id}) or mini-card alternate"
    conf = entry.get("confidence") or 0
    if conf < 0.55:
        return "Review manually — low confidence; consider unassigned/"
    return "Mini-card alternate or space detail header"


def generate_illustrations_ts(primary_by_slug: dict[str, str]) -> str:
    lines = [
        "/** Auto-generated from public/spaces/_manifest.json — space mini-card banner art. */",
        "const MINI_CARD_BASE = \"/spaces/mini-cards\";",
        "",
        "export const SPACE_MINI_CARD_ILLUSTRATION: Record<string, string> = {",
    ]
    for slug in sorted(primary_by_slug):
        lines.append(f'  "{slug}": `${{MINI_CARD_BASE}}/{primary_by_slug[slug]}`,')
    lines.extend(["};", ""])
    lines.extend([
        "export function spaceTypeIllustrationSlug(name: string | null | undefined): string {",
        '  if (!name?.trim()) return "";',
        "  return name",
        '    .trim()',
        '    .toLowerCase()',
        '    .replace(/[^a-z0-9]+/g, "-")',
        '    .replace(/^-+|-+$/g, "");',
        "}",
        "",
        "export function getSpaceMiniCardIllustration(",
        "  spaceTypeName: string | null | undefined",
        "): string | undefined {",
        "  const slug = spaceTypeIllustrationSlug(spaceTypeName);",
        "  if (!slug) return undefined;",
        "  if (SPACE_MINI_CARD_ILLUSTRATION[slug]) return SPACE_MINI_CARD_ILLUSTRATION[slug];",
        "  const base = slug.replace(/-\\d+$/, '');",
        "  return SPACE_MINI_CARD_ILLUSTRATION[base];",
        "}",
        "",
    ])
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Rename space PNGs using GPT-4o-mini vision")
    parser.add_argument("--dry-run", action="store_true", help="Preview only (default if --apply not set)")
    parser.add_argument("--apply", action="store_true", help="Copy renamed files to mini-cards/")
    parser.add_argument("--limit", type=int, default=0, help="Process at most N images (0 = all)")
    parser.add_argument("--force-reclassify", action="store_true", help="Ignore classification cache")
    parser.add_argument("--cache-only", action="store_true", help="Use cache only; do not call OpenAI")
    args = parser.parse_args()
    apply = args.apply
    dry_run = not apply

    load_dotenv(REPO_ROOT / ".env.local")
    load_dotenv(REPO_ROOT / ".env")

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key and not args.cache_only:
        print("ERROR: OPENAI_API_KEY not set. Export it, add to .env.local, or use --cache-only", file=sys.stderr)
        return 1

    client = None
    if not args.cache_only:
        try:
            from openai import OpenAI
        except ImportError:
            print("ERROR: pip install openai", file=sys.stderr)
            return 1
        client = OpenAI(api_key=api_key)

    if not INCOMING.is_dir():
        print(f"ERROR: missing {INCOMING}", file=sys.stderr)
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    space_types = parse_space_types()
    cache = {} if args.force_reclassify else load_cache()

    pngs = sorted(INCOMING.glob("*.png"), key=lambda p: (len(p.stem), p.stem))
    if args.limit:
        pngs = pngs[: args.limit]

    reserved: dict[str, str] = {}
    manifest: dict[str, Any] = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "dryRun": dry_run,
        "files": {},
        "primaryBySlug": {},
        "skipped": [],
        "unassigned": [],
    }

    for i, src in enumerate(pngs, 1):
        key = src.name
        print(f"[{i}/{len(pngs)}] {src.name} …", flush=True)

        if key in cache and not args.force_reclassify:
            classification = cache[key]
        elif args.cache_only:
            print(f"  skip (no cache entry)", flush=True)
            manifest["skipped"].append({"source": key, "error": "missing cache entry"})
            continue
        else:
            try:
                classification = classify_image(client, src, space_types)
                cache[key] = classification
                save_cache(cache)
            except Exception as exc:
                print(f"  classify failed: {exc}", file=sys.stderr)
                manifest["skipped"].append({"source": key, "error": str(exc)})
                continue
            time.sleep(0.25)

        canonical = classification.get("canonical_name")
        confidence = float(classification.get("confidence") or 0)
        free_label = classification.get("free_label") or classification.get("visual_summary") or ""

        if canonical and canonical in space_types:
            base_slug = slugify(canonical)
            space_type = canonical
        elif canonical:
            space_type = canonical
            base_slug = slugify(canonical)
        else:
            space_type = None
            base_slug = slugify(free_label[:40] if free_label else f"unassigned-{src.stem}")

        target_name, reason = pick_unique_target(base_slug, src, reserved)
        reserved[target_name] = file_hash(src)

        entry = {
            "source": key,
            "target": target_name,
            "spaceType": space_type,
            "slug": base_slug,
            "confidence": confidence,
            "freeLabel": free_label or None,
            "visualSummary": classification.get("visual_summary"),
            "action": reason,
            "suggestedUse": None,
        }
        entry["suggestedUse"] = suggest_alternate_use(entry)
        manifest["files"][target_name] = entry

        if space_type and base_slug not in manifest["primaryBySlug"] and reason != "identical_skip":
            manifest["primaryBySlug"][base_slug] = target_name
        elif not space_type:
            manifest["unassigned"].append(target_name)

        print(f"  → {target_name} ({space_type or free_label}, conf={confidence:.2f}, {reason})")

        if apply and reason != "identical_skip":
            dest = OUT_DIR / target_name
            shutil.copy2(src, dest)

    save_cache(cache)
    manifest["suggestedUsesForUnused"] = {
        "circulation": "SpaceGroupIdentityCard hero — /spaces/groups/circulation.png",
        "habitable": "Onboarding habitable group card thumbnail",
        "service": "Service areas strip / break room empty states",
        "sanitary": "Sanitary group hero + WC suggestion chips",
        "storage": "Storage group card + archive empty states",
        "technical": "Technical/plant group hero (plant room, boiler)",
        "external": "External areas hero (garden, car park, roof)",
        "lowConfidence": "Move to public/spaces/unassigned/ for manual review",
        "alternates": "Files with -2, -3 suffix — mini-card rotation or detail page headers",
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\nManifest: {MANIFEST_PATH}")

    if apply and manifest["primaryBySlug"]:
        ILLUSTRATIONS_TS.write_text(
            generate_illustrations_ts(manifest["primaryBySlug"]),
            encoding="utf-8",
        )
        print(f"Generated: {ILLUSTRATIONS_TS}")

    print(f"Done. {'DRY RUN — re-run with --apply to copy files.' if dry_run else 'Applied.'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
