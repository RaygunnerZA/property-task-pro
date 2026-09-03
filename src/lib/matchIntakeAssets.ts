/**
 * Conservative match of extracted document entities onto org assets.
 * Never trusts model-supplied IDs — only names/serials against an already
 * authorised, org+property-scoped asset list.
 */

export type IntakeDetectedAsset = {
  name?: string | null;
  serial_number?: string | null;
  model?: string | null;
  confidence?: number | null;
};

export type IntakeMatchableAsset = {
  id: string;
  name: string;
  serial_number?: string | null;
};

export type IntakeAssetMatch = {
  assetId: string;
  name: string;
  serial_number?: string | null;
};

export type IntakeUnmatchedAsset = {
  label: string;
  serial_number?: string | null;
};

export type IntakeAssetMatchResult = {
  matches: IntakeAssetMatch[];
  unmatched: IntakeUnmatchedAsset[];
};

const HIGH_CONFIDENCE = 0.72;

function normalizeToken(raw?: string | null): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/[_./]+/g, " ")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(raw?: string | null): string {
  return normalizeToken(raw).replace(/[\s-]+/g, "");
}

function isStrongProposal(detected: IntakeDetectedAsset): boolean {
  const name = normalizeToken(detected.name);
  const serial = normalizeToken(detected.serial_number);
  if (serial.length >= 3) return true;
  if (name.length < 3) return false;
  const confidence = typeof detected.confidence === "number" ? detected.confidence : 0;
  if (confidence >= HIGH_CONFIDENCE) return true;
  // Codes like LIFT-02 / LIFT02 in the name are strong identifiers.
  return /[a-z]{2,}\s*-?\s*\d{1,6}/.test(name);
}

function uniqueHit(
  assets: IntakeMatchableAsset[],
  predicate: (asset: IntakeMatchableAsset) => boolean
): IntakeMatchableAsset | null {
  const hits = assets.filter(predicate);
  return hits.length === 1 ? hits[0] : null;
}

export function collectDetectedAssets(input: {
  fromFiles?: IntakeDetectedAsset[][];
  fromImages?: IntakeDetectedAsset[][];
}): IntakeDetectedAsset[] {
  const out: IntakeDetectedAsset[] = [];
  const seen = new Set<string>();
  for (const group of [...(input.fromFiles ?? []), ...(input.fromImages ?? [])]) {
    for (const item of group) {
      const key = `${normalizeToken(item.name)}|${normalizeToken(item.serial_number)}`;
      if (!key.replace("|", "") || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  }
  return out.slice(0, 8);
}

/**
 * Exact name or serial only. Ambiguous hits are dropped (fail closed).
 * Unmatched rows are only surfaced when the extraction looks like a real asset.
 */
export function matchIntakeAssets(
  detected: IntakeDetectedAsset[],
  assets: IntakeMatchableAsset[]
): IntakeAssetMatchResult {
  const matches: IntakeAssetMatch[] = [];
  const unmatched: IntakeUnmatchedAsset[] = [];
  const matchedIds = new Set<string>();

  for (const item of detected) {
    const name = normalizeToken(item.name);
    const serial = normalizeToken(item.serial_number);
    const nameCompact = compact(item.name);
    const serialCompact = compact(item.serial_number);

    const bySerial =
      serialCompact.length >= 3
        ? uniqueHit(
            assets,
            (asset) =>
              compact(asset.serial_number) === serialCompact ||
              compact(asset.name) === serialCompact
          )
        : null;
    const byName =
      !bySerial && nameCompact.length >= 3
        ? uniqueHit(
            assets,
            (asset) =>
              compact(asset.name) === nameCompact ||
              compact(asset.serial_number) === nameCompact
          )
        : null;
    const hit = bySerial ?? byName;

    if (hit) {
      if (matchedIds.has(hit.id)) continue;
      matchedIds.add(hit.id);
      matches.push({
        assetId: hit.id,
        name: hit.name,
        serial_number: hit.serial_number,
      });
      continue;
    }

    if (isStrongProposal(item)) {
      const label = (item.name || item.serial_number || "").trim().slice(0, 80);
      if (!label) continue;
      unmatched.push({
        label,
        serial_number: item.serial_number?.trim() || null,
      });
    }
  }

  return { matches, unmatched };
}

export function formatLinkedAssetLabel(match: IntakeAssetMatch): string {
  const serial = match.serial_number?.trim();
  if (serial && !match.name.toLowerCase().includes(serial.toLowerCase())) {
    return `${match.name} · ${serial}`;
  }
  return match.name;
}
