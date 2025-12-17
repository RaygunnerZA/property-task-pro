/**
 * Hook for AI-powered chip suggestions in Create Task modal
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebounce } from './useDebounce';
import { useSpaces } from './useSpaces';
import { useTeams } from './useTeams';
import { useOrgMembers } from './useOrgMembers';
import { useGroups } from './useGroups';
import { useDataContext } from '@/contexts/DataContext';
import { generateChipSuggestions } from '@/services/ai/chipSuggestionEngine';
import { 
  ChipSuggestionContext, 
  ChipSuggestionResult,
  SuggestedChip,
  GhostGroup
} from '@/types/chip-suggestions';

interface UseChipSuggestionsOptions {
  debounceMs?: number;
  minDescriptionLength?: number;
}

interface UseChipSuggestionsReturn {
  chips: SuggestedChip[];
  ghostGroups: GhostGroup[];
  complianceMode: boolean;
  suggestedTitle?: string;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useChipSuggestions(
  context: ChipSuggestionContext,
  options: UseChipSuggestionsOptions = {}
): UseChipSuggestionsReturn {
  const { debounceMs = 300, minDescriptionLength = 3 } = options;
  const { orgId } = useDataContext();
  
  const [result, setResult] = useState<ChipSuggestionResult>({
    chips: [],
    ghostGroups: [],
    complianceMode: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Debounce description to avoid excessive processing
  const debouncedDescription = useDebounce(context.description, debounceMs);
  
  // Fetch entities
  const { spaces } = useSpaces(context.propertyId);
  const { teams } = useTeams(orgId);
  const { members } = useOrgMembers();
  const { groups } = useGroups();
  
  // Track if we should process
  const shouldProcess = debouncedDescription.length >= minDescriptionLength;
  
  // Generation function
  const generateSuggestions = useCallback(async () => {
    if (!shouldProcess) {
      setResult({ chips: [], ghostGroups: [], complianceMode: false });
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const entities = {
        spaces: spaces.map(s => ({
          id: s.id,
          name: s.name,
          property_id: s.property_id
        })),
        members: members.map(m => ({
          id: m.id,
          user_id: m.user_id,
          display_name: m.display_name
        })),
        teams: teams.map(t => ({
          id: t.id,
          name: t.name ?? ''
        })),
        groups: groups.map(g => ({
          id: g.id,
          name: g.name
        }))
      };
      
      const suggestions = await generateChipSuggestions(
        {
          description: debouncedDescription,
          propertyId: context.propertyId,
          selectedSpaceIds: context.selectedSpaceIds,
          selectedPersonId: context.selectedPersonId,
          selectedTeamIds: context.selectedTeamIds,
          imageOcrText: context.imageOcrText
        },
        entities
      );
      
      setResult(suggestions);
    } catch (err) {
      console.error('Chip suggestion error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate suggestions');
    } finally {
      setLoading(false);
    }
  }, [
    shouldProcess,
    debouncedDescription,
    context.propertyId,
    context.selectedSpaceIds,
    context.selectedPersonId,
    context.selectedTeamIds,
    context.imageOcrText,
    spaces,
    teams,
    members,
    groups
  ]);
  
  // Auto-generate on context changes
  useEffect(() => {
    generateSuggestions();
  }, [generateSuggestions]);
  
  return {
    chips: result.chips,
    ghostGroups: result.ghostGroups,
    complianceMode: result.complianceMode,
    suggestedTitle: result.suggestedTitle,
    loading,
    error,
    refresh: generateSuggestions
  };
}
