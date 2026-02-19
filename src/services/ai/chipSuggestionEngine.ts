/**
 * AI Chip Suggestion Engine
 * Combines rule-based, vector-based (future), and AI extraction (stub)
 *
 * Current implementation: Rule-based + Property Profile layer
 * Future: Will add vector similarity and AI model extraction
 * Phase 12B: Icon inference from description, hazards, detected objects
 */

import {
  ChipSuggestionContext,
  ChipSuggestionResult,
  SuggestedChip,
  GhostCategory,
} from "@/types/chip-suggestions";
import { extractChipsFromText } from "./ruleBasedExtractor";
import { supabase } from "@/integrations/supabase/client";
import {
  evaluateProfileForChipBoosts,
} from "@/services/propertyIntelligence/ruleEvaluator";

interface AvailableEntities {
  spaces: Array<{ id: string; name: string; property_id: string }>;
  members: Array<{ id: string; user_id: string; display_name: string }>;
  teams: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
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
  
  // Skip if no content to process (description, image OCR, or detected objects)
  const hasDescription = context.description && context.description.trim().length >= 3;
  const hasImageOcr = context.imageOcrText && context.imageOcrText.trim().length >= 3;
  const hasDetected = (context.detectedLabels?.length ?? 0) > 0 || (context.detectedObjects?.length ?? 0) > 0;
  if (!hasDescription && !hasImageOcr && !hasDetected) {
    return {
      chips: [],
      ghostCategories: [],
      complianceMode: false
    };
  }

  // 1. Rule-based extraction (primary layer)
  const ruleResult = extractChipsFromText(context, entities);

  // Phase 12B: Icon inference from description + detected objects + compliance
  let suggestedIcon: string | undefined;
  let suggestedIconAlternatives: string[] = [];
  try {
    const searchTerms = [
      context.description,
      context.detectedObjects?.map(o => o.label || o.type).join(' ') || '',
      ruleResult.complianceMode ? 'compliance inspection' : ''
    ].filter(Boolean).join(' ') || 'maintenance task';
    const { data: icons } = await supabase.rpc('ai_icon_search', { query_text: searchTerms });
    if (icons && Array.isArray(icons) && icons.length > 0) {
      const iconRows = icons as { name?: string }[];
      suggestedIcon = iconRows[0]?.name;
      suggestedIconAlternatives = iconRows.slice(1, 3).map(i => i.name).filter(Boolean) as string[];
    }
  } catch {
    // Non-fatal
  }

  // 2. Property Profile layer — boosts chips based on property characteristics
  // Runs when context.propertyProfile is provided by the calling hook.
  // Does not replace rule-based chips; adjusts scores using a max-merge strategy.
  const profileBoostMap = new Map<string, number>(); // chipType → boost score
  if (context.propertyProfile) {
    const boosts = evaluateProfileForChipBoosts(context.propertyProfile);
    for (const evaluated of boosts) {
      if (evaluated.output.kind === "chip_boost") {
        const existing = profileBoostMap.get(evaluated.output.chipType) ?? 0;
        profileBoostMap.set(
          evaluated.output.chipType,
          Math.max(existing, evaluated.output.score)
        );
      }
    }
  }

  // 3. Vector-based similarity (future implementation)
  // const vectorResult = await getVectorSimilarChips(context);

  // 4. AI model extraction (stub - will be connected later)
  // const aiResult = await getAIExtractedChips(context, entities);

  // Merge rule-based chips with profile boosts (max-merge, not additive — avoids over-boosting)
  const finalChips = ruleResult.chips.map((chip) => {
    const profileBoost = profileBoostMap.get(chip.type);
    const boostedScore = profileBoost != null
      ? Math.max(chip.score, profileBoost)
      : chip.score;
    return { ...chip, score: boostedScore };
  });

  // For chip types that have a profile boost but no rule-based chip yet,
  // inject a lightweight profile-derived chip so the type appears in the UI.
  for (const [chipType, boostScore] of profileBoostMap.entries()) {
    const alreadyPresent = finalChips.some((c) => c.type === chipType);
    if (!alreadyPresent && boostScore >= mergedConfig.minScore) {
      finalChips.push({
        id: `profile-boost-${chipType}`,
        type: chipType as SuggestedChip["type"],
        value: chipType,
        label: chipType,
        score: boostScore,
        source: "rule",
        metadata: { reason: "property_profile_boost" },
      });
    }
  }

  // Apply fallback logic if no chips detected
  if (finalChips.length === 0 && context.propertyId) {
    const fallbackChips = generateFallbackChips(context, entities);
    finalChips.push(...fallbackChips);
  }

  return {
    chips: finalChips.filter((c) => c.score >= mergedConfig.minScore),
    ghostCategories: ruleResult.ghostCategories.filter(
      (c) => c.score >= mergedConfig.minScore
    ),
    suggestedTitle: ruleResult.suggestedTitle,
    suggestedIcon,
    suggestedIconAlternatives,
    complianceMode: ruleResult.complianceMode,
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
