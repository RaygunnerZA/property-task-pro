/**
 * Merge ai-extract `people` results into rule-based SuggestedChip list.
 * Unknown people become blocking invite verb chips; known members become resolved person chips.
 */

import type { SuggestedChip } from "@/types/chip-suggestions";
import { isRejectedPersonName } from "./personNameHeuristics";

export interface AiExtractedPerson {
  name: string;
  exists: boolean;
  id?: string;
  authority?: number;
}

function normalizePersonName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function personTokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.replace(/[^a-z'-]/g, ""))
      .filter((t) => t.length >= 2)
  );
}

function personNamesOverlap(a: string, b: string): boolean {
  const ta = personTokens(a);
  const tb = personTokens(b);
  if (ta.size === 0 || tb.size === 0) return false;
  for (const t of ta) {
    if (tb.has(t)) return true;
  }
  return false;
}

function existingPersonKeys(chips: SuggestedChip[]): Set<string> {
  const keys = new Set<string>();
  for (const chip of chips) {
    if (chip.type !== "person") continue;
    const label = (chip.label || chip.value || "").trim();
    if (!label) continue;
    keys.add(label.toLowerCase());
    for (const t of personTokens(label)) keys.add(t);
  }
  return keys;
}

/**
 * Append AI-extracted people not already covered by rule-based person chips.
 */
export function mergeAiPeopleIntoChips(
  chips: SuggestedChip[],
  people: AiExtractedPerson[] | undefined | null,
  options?: { contextText?: string }
): SuggestedChip[] {
  if (!people?.length) return chips;

  const result = [...chips];
  const seen = existingPersonKeys(chips);
  const contextText = options?.contextText;

  for (const person of people) {
    const raw = person.name?.trim();
    if (!raw || raw.length < 2) continue;
    if (isRejectedPersonName(raw, contextText)) continue;

    const display = normalizePersonName(raw);
    const lower = display.toLowerCase();

    if (seen.has(lower)) continue;
    if ([...seen].some((key) => personNamesOverlap(key, display))) continue;

    if (person.exists && person.id) {
      result.push({
        id: `person-ai-${person.id}`,
        type: "person",
        value: person.id,
        label: display,
        score: Math.min(0.95, 0.72 + (person.authority ?? 0) * 0.2),
        source: "ai",
        resolvedEntityId: person.id,
        resolvedEntityType: "person",
        blockingRequired: false,
        metadata: { detectedAs: "ai_extract_member" },
      });
    } else {
      result.push({
        id: `person-ai-invite-${lower.replace(/\s+/g, "-")}`,
        type: "person",
        value: display,
        label: display,
        score: Math.min(0.9, 0.68 + (person.authority ?? 0) * 0.2),
        source: "ai",
        blockingRequired: true,
        metadata: { detectedAs: "ai_extract_invite" },
      });
    }

    seen.add(lower);
    for (const t of personTokens(display)) seen.add(t);
  }

  return result;
}
