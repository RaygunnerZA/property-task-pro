/**
 * Sync enrichment: match unresolved suggestion chips to org entities already in the DB.
 * Enables fact chips (e.g. STOVE) in the intake summary row when the asset exists.
 */

import type { SuggestedChip } from "@/types/chip-suggestions";

export interface EnrichEntitiesContext {
  members: Array<{ id: string; user_id: string; display_name: string }>;
  teams: Array<{ id: string; name: string }>;
  spaces: Array<{ id: string; name: string; property_id: string }>;
  assets: Array<{ id: string; name: string }>;
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function singularize(value: string): string {
  const v = normalizeName(value);
  if (v.length > 3 && v.endsWith("s")) return v.slice(0, -1);
  return v;
}

function namesMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  return singularize(na) === singularize(nb);
}

function findAssetByLabel(label: string, assets: EnrichEntitiesContext["assets"]) {
  return assets.find((asset) => asset.name && namesMatch(label, asset.name));
}

function findSpaceByLabel(label: string, spaces: EnrichEntitiesContext["spaces"]) {
  return spaces.find((space) => space.name && namesMatch(label, space.name));
}

function findTeamByLabel(label: string, teams: EnrichEntitiesContext["teams"]) {
  return teams.find((team) => team.name && namesMatch(label, team.name));
}

function findMemberByLabel(label: string, members: EnrichEntitiesContext["members"]) {
  return members.find((member) => {
    const display = member.display_name?.trim();
    if (!display) return false;
    if (namesMatch(label, display)) return true;
    const parts = display.split(/\s+/).filter(Boolean);
    return parts.some((part) => part.length > 2 && namesMatch(label, part));
  });
}

/**
 * Attach resolvedEntityId when label matches a known entity (exact / singular name).
 */
export function enrichSuggestionChipsWithEntities(
  chips: SuggestedChip[],
  entities: EnrichEntitiesContext
): SuggestedChip[] {
  return chips.map((chip) => {
    const label = (chip.label || chip.value || "").trim();
    if (!label) return chip;

    if (chip.type === "asset" && !chip.resolvedEntityId) {
      const match = findAssetByLabel(label, entities.assets);
      if (match) {
        return {
          ...chip,
          resolvedEntityId: match.id,
          resolvedEntityType: "asset",
          blockingRequired: false,
        };
      }
    }

    if (chip.type === "space" && !chip.resolvedEntityId) {
      const match = findSpaceByLabel(label, entities.spaces);
      if (match) {
        return {
          ...chip,
          resolvedEntityId: match.id,
          resolvedEntityType: "space",
          blockingRequired: false,
        };
      }
    }

    if (chip.type === "team" && !chip.resolvedEntityId) {
      const match = findTeamByLabel(label, entities.teams);
      if (match) {
        return {
          ...chip,
          resolvedEntityId: match.id,
          resolvedEntityType: "team",
          blockingRequired: false,
        };
      }
    }

    if (chip.type === "person" && !chip.resolvedEntityId && chip.blockingRequired) {
      const match = findMemberByLabel(label, entities.members);
      if (match) {
        return {
          ...chip,
          resolvedEntityId: match.user_id,
          resolvedEntityType: "person",
          blockingRequired: false,
          label: match.display_name || label,
        };
      }
    }

    return chip;
  });
}
