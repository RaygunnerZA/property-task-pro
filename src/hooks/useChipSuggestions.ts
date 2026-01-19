/**
 * Hook for AI-powered chip suggestions in Create Task modal
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebounce } from './useDebounce';
import { useSpaces } from './useSpaces';
import { useTeams } from './useTeams';
import { useOrgMembers } from './useOrgMembers';
import { useCategories } from './useCategories';
import { useDataContext } from '@/contexts/DataContext';
import { generateChipSuggestions } from '@/services/ai/chipSuggestionEngine';
import { 
  ChipSuggestionContext, 
  ChipSuggestionResult,
  SuggestedChip,
  GhostCategory
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
    ghostCategories: [],
    complianceMode: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Debounce description to avoid excessive processing
  const debouncedDescription = useDebounce(context.description, debounceMs);
  
  // Fetch entities
  const { spaces } = useSpaces(context.propertyId);
  const { teams } = useTeams();
  const { members } = useOrgMembers();
  const { categories } = useCategories();
  
  // Use refs to store latest arrays to avoid dependency issues
  const spacesRef = useRef(spaces);
  const teamsRef = useRef(teams);
  const membersRef = useRef(members);
  const categoriesRef = useRef(categories);
  const contextRef = useRef(context);
  
  // Update refs when values change
  useEffect(() => {
    spacesRef.current = spaces;
  }, [spaces]);
  useEffect(() => {
    teamsRef.current = teams;
  }, [teams]);
  useEffect(() => {
    membersRef.current = members;
  }, [members]);
  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);
  // Extract context properties for stable dependencies
  const contextPropertyId = context.propertyId;
  const contextSelectedPersonId = context.selectedPersonId;
  const contextImageOcrText = context.imageOcrText;
  
  useEffect(() => {
    contextRef.current = context;
  }, [context, contextPropertyId, contextSelectedPersonId, contextImageOcrText]);
  
  // Create stable string keys for array dependencies (copy arrays before sorting to avoid mutation)
  const selectedSpaceIdsKey = Array.isArray(context.selectedSpaceIds) 
    ? [...context.selectedSpaceIds].sort().join(',') 
    : '';
  const selectedTeamIdsKey = Array.isArray(context.selectedTeamIds)
    ? [...context.selectedTeamIds].sort().join(',')
    : '';
  const spacesKey = spaces.map(s => s.id).sort().join(',');
  const teamsKey = teams.map(t => t.id).sort().join(',');
  const membersKey = members.map(m => m.id || m.user_id).sort().join(',');
  const categoriesKey = categories.map(c => c.id).sort().join(',');
  
  // Track if we should process
  const shouldProcess = debouncedDescription.length >= minDescriptionLength;
  
  // Generation function - use refs to access latest values without dependencies
  const generateSuggestions = useCallback(async () => {
    const latestSpaces = spacesRef.current;
    const latestTeams = teamsRef.current;
    const latestMembers = membersRef.current;
    const latestCategories = categoriesRef.current;
    const latestContext = contextRef.current;
    
    if (!shouldProcess) {
      setResult({ chips: [], ghostCategories: [], complianceMode: false });
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const entities = {
        spaces: latestSpaces.map(s => ({
          id: s.id,
          name: s.name,
          property_id: s.property_id
        })),
        members: latestMembers.map(m => ({
          id: m.id,
          user_id: m.user_id,
          display_name: m.display_name
        })),
        teams: latestTeams.map(t => ({
          id: t.id,
          name: t.name ?? ''
        })),
        categories: latestCategories.map(c => ({
          id: c.id,
          name: c.name
        }))
      };
      
      const suggestions = await generateChipSuggestions(
        {
          description: debouncedDescription,
          propertyId: latestContext.propertyId,
          selectedSpaceIds: latestContext.selectedSpaceIds,
          selectedPersonId: latestContext.selectedPersonId,
          selectedTeamIds: latestContext.selectedTeamIds,
          imageOcrText: latestContext.imageOcrText
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
    contextPropertyId,
    selectedSpaceIdsKey,
    contextSelectedPersonId,
    selectedTeamIdsKey,
    contextImageOcrText,
    spacesKey,
    teamsKey,
    membersKey,
    categoriesKey
  ]);
  
  // Auto-generate on context changes
  useEffect(() => {
    generateSuggestions();
  }, [generateSuggestions]);
  
  return {
    chips: result.chips,
    ghostCategories: result.ghostCategories,
    complianceMode: result.complianceMode,
    suggestedTitle: result.suggestedTitle,
    loading,
    error,
    refresh: generateSuggestions
  };
}
