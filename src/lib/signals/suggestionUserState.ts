import type { SuggestionUserState } from "./actionableSuggestionTypes";

const PREFIX = "filla.suggestionState.";

export function suggestionStateStorageKey(orgId: string) {
  return `${PREFIX}${orgId}`;
}

export function readSuggestionUserState(orgId: string | null | undefined): Record<string, SuggestionUserState> {
  if (!orgId || typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(suggestionStateStorageKey(orgId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, SuggestionUserState>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeSuggestionUserState(
  orgId: string,
  next: Record<string, SuggestionUserState>
) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(suggestionStateStorageKey(orgId), JSON.stringify(next));
}

export function upsertSuggestionUserState(
  orgId: string,
  suggestionId: string,
  patch: SuggestionUserState
): Record<string, SuggestionUserState> {
  const current = readSuggestionUserState(orgId);
  const next = { ...current, [suggestionId]: { ...current[suggestionId], ...patch } };
  writeSuggestionUserState(orgId, next);
  return next;
}
