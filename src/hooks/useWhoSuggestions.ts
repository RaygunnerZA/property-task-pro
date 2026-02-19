/**
 * useWhoSuggestions - Real-time DB matching for Who section
 *
 * Step 1: Normalise input (trim, case-insensitive, remove punctuation, tokenise)
 * Step 2: DB matching against users + teams (exact, starts-with)
 * Step 3: Classification rules:
 *   - Exact/strong match → proposal chip (person or team)
 *   - No match + proper noun → INVITE [name]
 *   - No match + generic noun → CREATE [name] TEAM
 */

import { useState, useEffect, useMemo } from "react";
import { useOrgMembers } from "./useOrgMembers";
import { useTeams } from "./useTeams";

const COMMON_NOUNS = new Set([
  "cleaning",
  "maintenance",
  "plumbing",
  "security",
  "repairs",
  "inspection",
  "admin",
  "management",
  "grounds",
  "electrical",
  "hvac",
  "pest",
  "landscaping",
]);

function normaliseInput(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const noPunct = trimmed.replace(/[^\w\s'-]/g, "");
  return noPunct.split(/\s+/).filter(Boolean);
}

function looksLikeProperNoun(token: string): boolean {
  if (token.length <= 2) return false;
  if (COMMON_NOUNS.has(token.toLowerCase())) return false;
  return token[0] === token[0].toUpperCase() && token[0] !== token[0].toLowerCase();
}

function looksLikeGenericTeam(token: string): boolean {
  const lower = token.toLowerCase();
  if (lower.endsWith("ing")) return true;
  return COMMON_NOUNS.has(lower);
}

export type WhoProposalType = "person" | "team" | "invite" | "create_team";

export interface WhoProposal {
  id: string;
  type: WhoProposalType;
  label: string;
  entityId?: string;
  entityType?: "person" | "team";
}

const DEBOUNCE_MS = 150;

export function useWhoSuggestions(inputValue: string, enabled: boolean) {
  const { members } = useOrgMembers();
  const { teams } = useTeams();
  const [debouncedValue, setDebouncedValue] = useState("");

  useEffect(() => {
    if (!enabled) {
      setDebouncedValue("");
      return;
    }
    const t = setTimeout(() => setDebouncedValue(inputValue), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [inputValue, enabled]);

  return useMemo((): WhoProposal[] => {
    const trimmed = debouncedValue.trim();
    if (!trimmed) return [];

    const lowerInput = trimmed.toLowerCase();
    const tokens = normaliseInput(trimmed);
    const firstToken = tokens[0] ?? "";

    // Step 2: DB matching
    const personExact = members.find(
      (m) => m.display_name.toLowerCase() === lowerInput
    );
    const personStartsWith = members.filter(
      (m) =>
        m.display_name.toLowerCase().startsWith(lowerInput) &&
        m.display_name.toLowerCase() !== lowerInput
    );
    const teamExact = teams.find(
      (t) => (t.name || "").toLowerCase() === lowerInput
    );
    const teamStartsWith = teams.filter(
      (t) =>
        (t.name || "").toLowerCase().startsWith(lowerInput) &&
        (t.name || "").toLowerCase() !== lowerInput
    );

    // Team match does NOT suppress person suggestion — collect both when applicable
    const proposals: WhoProposal[] = [];

    if (teamExact) {
      proposals.push({
        id: `team-${teamExact.id}`,
        type: "team",
        label: (teamExact.name || "Unnamed Team").toUpperCase(),
        entityId: teamExact.id,
        entityType: "team",
      });
    }

    // Add team starts-with proposals
    if (teamStartsWith.length === 1) {
      const t = teamStartsWith[0];
      proposals.push({
        id: `team-${t.id}`,
        type: "team",
        label: (t.name || "Unnamed Team").toUpperCase(),
        entityId: t.id,
        entityType: "team",
      });
    } else if (teamStartsWith.length > 1) {
      teamStartsWith.slice(0, 3).forEach((t) =>
        proposals.push({
          id: `team-${t.id}`,
          type: "team",
          label: (t.name || "Unnamed Team").toUpperCase(),
          entityId: t.id,
          entityType: "team",
        })
      );
    }

    // Add person proposals (team match does NOT suppress person)
    if (personExact) {
      proposals.push({
        id: `person-${personExact.user_id}`,
        type: "person",
        label: personExact.display_name.toUpperCase(),
        entityId: personExact.user_id,
        entityType: "person",
      });
    } else if (personStartsWith.length === 1) {
      const m = personStartsWith[0];
      proposals.push({
        id: `person-${m.user_id}`,
        type: "person",
        label: m.display_name.toUpperCase(),
        entityId: m.user_id,
        entityType: "person",
      });
    } else if (personStartsWith.length > 1) {
      personStartsWith.slice(0, 3).forEach((m) =>
        proposals.push({
          id: `person-${m.user_id}`,
          type: "person",
          label: m.display_name.toUpperCase(),
          entityId: m.user_id,
          entityType: "person",
        })
      );
    }

    // Team match does NOT suppress person: if we have team but no person and input looks like proper noun, add Invite
    const isLikelyPerson =
      looksLikeProperNoun(firstToken) ||
      (tokens.length === 1 && firstToken.length > 2 && !COMMON_NOUNS.has(firstToken.toLowerCase()));
    const hasPerson = proposals.some((p) => p.type === "person");
    if (proposals.length > 0 && !hasPerson && isLikelyPerson) {
      const displayName = trimmed
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
      proposals.push({
        id: `invite-${Date.now()}-${displayName}`,
        type: "invite",
        label: `Invite ${displayName}`,
      });
    }

    if (proposals.length > 0) return proposals;

    // No match: classify by heuristic — Case B: Proper noun → INVITE [name]
    if (isLikelyPerson) {
      const displayName = trimmed
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
      return [
        {
          id: `invite-${Date.now()}-${displayName}`,
          type: "invite",
          label: `Invite ${displayName}`,
        },
      ];
    }

    // Case C: Generic noun → Add [name] (team)
    if (looksLikeGenericTeam(firstToken) || tokens.some((t) => looksLikeGenericTeam(t))) {
      const teamName = trimmed
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
      return [
        {
          id: `create-team-${Date.now()}-${teamName}`,
          type: "create_team",
          label: `Add ${teamName}`,
        },
      ];
    }

    // Fallback: if single word and not in common nouns, treat as invite
    if (tokens.length === 1 && firstToken.length > 2) {
      const displayName = firstToken.charAt(0).toUpperCase() + firstToken.slice(1).toLowerCase();
      return [
        {
          id: `invite-${Date.now()}-${displayName}`,
          type: "invite",
          label: `Invite ${displayName}`,
        },
      ];
    }

    return [];
  }, [debouncedValue, members, teams]);
}
