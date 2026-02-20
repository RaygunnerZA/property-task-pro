/**
 * Hook for chip suggestions in Create Task modal.
 *
 * Two-phase approach for instant responsiveness:
 *   Phase 1 — synchronous (useMemo, no debounce, no network):
 *     Rule-based extraction + property profile boosts.
 *     Chips appear as the user types with zero network latency.
 *   Phase 2 — async (debounced, background):
 *     Icon suggestion from ai_icon_search RPC.
 *     Does NOT block chip display.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useDebounce } from './useDebounce';
import { useSpaces } from './useSpaces';
import { useTeams } from './useTeams';
import { useOrgMembers } from './useOrgMembers';
import { useCategories } from './useCategories';
import { useOrgScope } from '@/hooks/useOrgScope';
import { extractChipsSync, generateChipSuggestions } from '@/services/ai/chipSuggestionEngine';
import {
  ChipSuggestionContext,
  SuggestedChip,
  GhostCategory,
} from '@/types/chip-suggestions';

interface UseChipSuggestionsOptions {
  debounceMs?: number;
  minDescriptionLength?: number;
}

interface UseChipSuggestionsReturn {
  chips: SuggestedChip[];
  ghostCategories: GhostCategory[];
  complianceMode: boolean;
  suggestedTitle?: string;
  suggestedIcon?: string;
  suggestedIconAlternatives?: string[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useChipSuggestions(
  context: ChipSuggestionContext,
  options: UseChipSuggestionsOptions = {}
): UseChipSuggestionsReturn {
  const { debounceMs = 600, minDescriptionLength = 3 } = options;
  const { orgId, orgLoading } = useOrgScope();

  // Fetch entities (cached by their own hooks)
  const { spaces } = useSpaces(context.propertyId);
  const { teams } = useTeams();
  const { members } = useOrgMembers();
  const { categories } = useCategories();

  // Icon enrichment state (Phase 2 only)
  const [suggestedIcon, setSuggestedIcon] = useState<string | undefined>();
  const [suggestedIconAlternatives, setSuggestedIconAlternatives] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Stable entity objects to avoid spurious useMemo re-runs
  const entities = useMemo(() => ({
    spaces: (spaces ?? []).map(s => ({ id: s.id, name: s.name, property_id: s.property_id })),
    members: (members ?? []).map(m => ({ id: m.id, user_id: m.user_id, display_name: m.display_name })),
    teams: (teams ?? []).map(t => ({ id: t.id, name: t.name ?? '' })),
    categories: (categories ?? []).map(c => ({ id: c.id, name: c.name })),
  }), [spaces, members, teams, categories]);

  // ── Phase 1: synchronous chip extraction (instant, no debounce) ──────────
  const syncResult = useMemo(() => {
    const desc = context.description?.trim() ?? '';
    if (desc.length < minDescriptionLength) {
      return { chips: [] as SuggestedChip[], ghostCategories: [] as GhostCategory[], complianceMode: false, suggestedTitle: undefined as string | undefined };
    }
    try {
      return extractChipsSync(
        {
          description: desc,
          propertyId: context.propertyId,
          selectedSpaceIds: context.selectedSpaceIds,
          selectedPersonId: context.selectedPersonId,
          selectedTeamIds: context.selectedTeamIds,
          imageOcrText: context.imageOcrText,
          detectedLabels: context.detectedLabels,
          detectedObjects: context.detectedObjects,
          propertyProfile: context.propertyProfile,
        },
        entities
      );
    } catch {
      return { chips: [] as SuggestedChip[], ghostCategories: [] as GhostCategory[], complianceMode: false, suggestedTitle: undefined as string | undefined };
    }
  }, [
    context.description,
    context.propertyId,
    context.selectedSpaceIds,
    context.selectedPersonId,
    context.selectedTeamIds,
    context.imageOcrText,
    context.detectedLabels,
    context.detectedObjects,
    context.propertyProfile,
    entities,
    minDescriptionLength,
  ]);

  // ── Phase 2: async icon enrichment (debounced, non-blocking) ─────────────
  const debouncedDescription = useDebounce(context.description, debounceMs);

  useEffect(() => {
    const desc = debouncedDescription?.trim() ?? '';
    if (!orgId || orgLoading || desc.length < minDescriptionLength) return;
    let cancelled = false;

    generateChipSuggestions(
      {
        description: desc,
        propertyId: context.propertyId,
        selectedSpaceIds: context.selectedSpaceIds,
        selectedPersonId: context.selectedPersonId,
        selectedTeamIds: context.selectedTeamIds,
        imageOcrText: context.imageOcrText,
        detectedLabels: context.detectedLabels,
        detectedObjects: context.detectedObjects,
        propertyProfile: context.propertyProfile,
      },
      entities
    )
      .then((result) => {
        if (!cancelled) {
          setSuggestedIcon(result.suggestedIcon);
          setSuggestedIconAlternatives(result.suggestedIconAlternatives ?? []);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Icon suggestion failed');
      });

    return () => { cancelled = true; };
  }, [orgId, orgLoading, debouncedDescription, context.propertyId, entities, minDescriptionLength]);

  const refresh = useCallback(() => {
    setSuggestedIcon(undefined);
    setSuggestedIconAlternatives([]);
  }, []);

  return {
    chips: syncResult.chips,
    ghostCategories: syncResult.ghostCategories,
    complianceMode: syncResult.complianceMode,
    suggestedTitle: syncResult.suggestedTitle,
    suggestedIcon,
    suggestedIconAlternatives,
    loading: false, // chips are always ready synchronously
    error,
    refresh,
  };
}
