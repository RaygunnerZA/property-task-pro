/**
 * AI Chip Suggestion Engine
 * Combines rule-based, vector-based (future), and AI extraction (stub)
 * 
 * Current implementation: Rule-based only
 * Future: Will add vector similarity and AI model extraction
 */

import { 
  ChipSuggestionContext, 
  ChipSuggestionResult,
  SuggestedChip,
  GhostCategory
} from '@/types/chip-suggestions';
import { extractChipsFromText } from './ruleBasedExtractor';

interface AvailableEntities {
  spaces: Array<{ id: string; name: string; property_id: string }>;
  members: Array<{ id: string; user_id: string; display_name: string }>;
  teams: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  properties?: Array<{ id: string; name?: string; nickname?: string; address?: string }>;
  assets?: Array<{ id: string; name?: string; serial?: string }>;
}

interface SuggestionEngineConfig {
  // Weight factors for different sources
  ruleWeight: number;
  vectorWeight: number;
  aiWeight: number;
  // Minimum score threshold
  minScore: number;
}

const defaultConfig: SuggestionEngineConfig = {
  ruleWeight: 0.5,
  vectorWeight: 0.3, // Future use
  aiWeight: 0.2,     // Future use
  minScore: 0.5
};

/**
 * Main suggestion engine function
 * Currently uses rule-based extraction only
 * Will be extended with vector and AI layers
 */
export async function generateChipSuggestions(
  context: ChipSuggestionContext,
  entities: AvailableEntities,
  config: Partial<SuggestionEngineConfig> = {}
): Promise<ChipSuggestionResult> {
  const mergedConfig = { ...defaultConfig, ...config };
  
  // Skip if no description
  if (!context.description || context.description.trim().length < 3) {
    return {
      chips: [],
      ghostCategories: [],
      complianceMode: false
    };
  }
  
  // 1. Rule-based extraction (primary layer)
  const ruleResult = extractChipsFromText(context, entities);
  
  // 2. Vector-based similarity (future implementation)
  // const vectorResult = await getVectorSimilarChips(context);
  
  // 3. AI model extraction (stub - will be connected later)
  // const aiResult = await getAIExtractedChips(context, entities);
  
  // For now, return rule-based results directly
  // Future: Merge and weight results from all three sources
  const finalChips = ruleResult.chips.map(chip => ({
    ...chip,
    // Future: score = (chip.score * ruleWeight) + (vectorScore * vectorWeight) + (aiScore * aiWeight)
    score: chip.score * mergedConfig.ruleWeight / mergedConfig.ruleWeight // Normalize for now
  }));
  
  // Apply fallback logic if no chips detected
  if (finalChips.length === 0 && context.propertyId) {
    const fallbackChips = generateFallbackChips(context, entities);
    finalChips.push(...fallbackChips);
  }
  
  return {
    chips: finalChips.filter(c => c.score >= mergedConfig.minScore),
    ghostCategories: ruleResult.ghostCategories.filter(c => c.score >= mergedConfig.minScore),
    suggestedTitle: ruleResult.suggestedTitle,
    complianceMode: ruleResult.complianceMode
  };
}

/**
 * Generate fallback chips when no other suggestions available
 */
function generateFallbackChips(
  context: ChipSuggestionContext,
  entities: AvailableEntities
): SuggestedChip[] {
  const fallbacks: SuggestedChip[] = [];
  
  // Suggest most recent space for property
  if (context.propertyId) {
    const propertySpaces = entities.spaces.filter(s => s.property_id === context.propertyId);
    if (propertySpaces.length > 0) {
      fallbacks.push({
        id: `fallback-space-${propertySpaces[0].id}`,
        type: 'space',
        value: propertySpaces[0].id,
        label: propertySpaces[0].name,
        score: 0.4,
        source: 'fallback',
        metadata: { reason: 'default_property_space' }
      });
    }
  }
  
  // Default priority suggestion
  fallbacks.push({
    id: `fallback-priority-medium`,
    type: 'priority',
    value: 'medium',
    label: 'Normal Priority',
    score: 0.3,
    source: 'fallback'
  });
  
  return fallbacks;
}

// ============================================
// STUB FUNCTIONS FOR FUTURE IMPLEMENTATION
// ============================================

/**
 * STUB: Vector-based similarity search
 * Will query task_embeddings table using pgvector
 * @future Implement when pgvector is enabled
 */
// async function getVectorSimilarChips(
//   context: ChipSuggestionContext
// ): Promise<{ chips: SuggestedChip[]; ghostCategories: GhostCategory[] }> {
//   // Future implementation:
//   // 1. Generate embedding for context.description
//   // 2. Query: SELECT * FROM task_embeddings ORDER BY embedding <-> input_embedding LIMIT 10
//   // 3. Extract common spaces, assignees, categories from similar tasks
//   // 4. Return chips with vector-based scores
  //   return { chips: [], ghostCategories: [] };
// }

/**
 * STUB: AI model extraction
 * Will call AI service for intelligent extraction
 * @future Connect to AI service when ready
 */
// async function getAIExtractedChips(
//   context: ChipSuggestionContext,
//   entities: AvailableEntities
// ): Promise<{ chips: SuggestedChip[]; suggestedTitle?: string }> {
//   // Future implementation:
//   // 1. Call AI service with context and available entities
//   // 2. Parse AI response into chips
//   // 3. Store in ai_extractions table
//   // 4. Return chips with AI-based scores
//   return { chips: [] };
// }
