/**
 * Resolution Pipeline
 * Deterministic 4-step resolution for AI-suggested entities
 * 
 * Steps:
 * 1. Exact match - Same ID → auto-resolve
 * 2. Fuzzy match - Case, plural, nickname, alias → auto-resolve
 * 3. Ambiguous - Multiple candidates → inline ask
 * 4. Missing - Entity doesn't exist → must create
 */

import { SuggestedChip, ChipType, EntityType, ResolutionSource } from '@/types/chip-suggestions';

export interface ResolutionResult {
  resolved: boolean;
  entityId?: string;
  entityType?: EntityType;
  resolutionSource?: ResolutionSource;
  confidence?: number;
  candidates?: Array<{ id: string; label: string; type: EntityType }>;
  requiresUserChoice?: boolean;
  requiresCreation?: boolean;
}

export interface AvailableEntities {
  spaces: Array<{ id: string; name: string; property_id: string }>;
  members: Array<{ id: string; user_id: string; display_name: string }>;
  teams: Array<{ id: string; name: string }>;
  assets: Array<{ id: string; name: string; property_id: string; space_id?: string }>;
  categories: Array<{ id: string; name: string; parent_id?: string }>;
  properties: Array<{ id: string; nickname?: string; address: string }>;
}

/**
 * Normalize string for fuzzy matching
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Check if two strings are fuzzy matches
 */
function isFuzzyMatch(str1: string, str2: string, threshold: number = 0.8): boolean {
  const normalized1 = normalizeString(str1);
  const normalized2 = normalizeString(str2);
  
  // Exact match after normalization
  if (normalized1 === normalized2) return true;
  
  // Check if one contains the other
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    return true;
  }
  
  // Check for plural/singular variations
  const plural1 = normalized1.endsWith('s') ? normalized1.slice(0, -1) : normalized1 + 's';
  const plural2 = normalized2.endsWith('s') ? normalized2.slice(0, -1) : normalized2 + 's';
  if (normalized1 === plural2 || normalized2 === plural1) return true;
  
  // Simple Levenshtein-like check for close matches
  const longer = normalized1.length > normalized2.length ? normalized1 : normalized2;
  const shorter = normalized1.length > normalized2.length ? normalized2 : normalized1;
  const distance = levenshteinDistance(normalized1, normalized2);
  const similarity = 1 - (distance / longer.length);
  
  return similarity >= threshold;
}

/**
 * Simple Levenshtein distance calculation
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Resolve a chip through the 4-step pipeline
 */
export async function resolveChip(
  chip: SuggestedChip,
  entities: AvailableEntities,
  context?: {
    propertyId?: string;
    spaceId?: string;
  }
): Promise<ResolutionResult> {
  // Step 1: Exact Match
  if (chip.value && !chip.value.startsWith('ghost-')) {
    const exactMatch = findExactMatch(chip, entities, context);
    if (exactMatch) {
      return {
        resolved: true,
        entityId: exactMatch.id,
        entityType: exactMatch.type,
        resolutionSource: 'exact',
        confidence: 1.0
      };
    }
  }
  
  // Step 2: Fuzzy Match
  const fuzzyMatches = findFuzzyMatches(chip, entities, context);
  if (fuzzyMatches.length === 1) {
    return {
      resolved: true,
      entityId: fuzzyMatches[0].id,
      entityType: fuzzyMatches[0].type,
      resolutionSource: 'fuzzy',
      confidence: 0.85
    };
  }
  
  // Step 3: Ambiguous (multiple candidates)
  if (fuzzyMatches.length > 1) {
    return {
      resolved: false,
      candidates: fuzzyMatches,
      requiresUserChoice: true,
      confidence: 0.7
    };
  }
  
  // Step 4: Missing (no matches)
  return {
    resolved: false,
    requiresCreation: true,
    confidence: 0.0
  };
}

/**
 * Find exact match by ID
 */
function findExactMatch(
  chip: SuggestedChip,
  entities: AvailableEntities,
  context?: { propertyId?: string; spaceId?: string }
): { id: string; type: EntityType } | null {
  const chipValue = chip.value;
  
  // Check spaces
  for (const space of entities.spaces) {
    if (space.id === chipValue) {
      if (!context?.propertyId || space.property_id === context.propertyId) {
        return { id: space.id, type: 'space' };
      }
    }
  }
  
  // Check members
  for (const member of entities.members) {
    if (member.id === chipValue || member.user_id === chipValue) {
      return { id: member.user_id, type: 'person' };
    }
  }
  
  // Check teams
  for (const team of entities.teams) {
    if (team.id === chipValue) {
      return { id: team.id, type: 'team' };
    }
  }
  
  // Check assets
  for (const asset of entities.assets) {
    if (asset.id === chipValue) {
      if (!context?.propertyId || asset.property_id === context.propertyId) {
        return { id: asset.id, type: 'asset' };
      }
    }
  }
  
  // Check categories
  for (const category of entities.categories) {
    if (category.id === chipValue) {
      return { id: category.id, type: 'category' };
    }
  }
  
  return null;
}

/**
 * Find fuzzy matches by name
 */
function findFuzzyMatches(
  chip: SuggestedChip,
  entities: AvailableEntities,
  context?: { propertyId?: string; spaceId?: string }
): Array<{ id: string; label: string; type: EntityType }> {
  const matches: Array<{ id: string; label: string; type: EntityType }> = [];
  const chipLabel = chip.label;
  
  // Match spaces
  for (const space of entities.spaces) {
    if (isFuzzyMatch(chipLabel, space.name)) {
      if (!context?.propertyId || space.property_id === context.propertyId) {
        matches.push({ id: space.id, label: space.name, type: 'space' });
      }
    }
  }
  
  // Match members
  for (const member of entities.members) {
    if (isFuzzyMatch(chipLabel, member.display_name)) {
      matches.push({ id: member.user_id, label: member.display_name, type: 'person' });
    }
  }
  
  // Match teams
  for (const team of entities.teams) {
    if (isFuzzyMatch(chipLabel, team.name)) {
      matches.push({ id: team.id, label: team.name, type: 'team' });
    }
  }
  
  // Match assets
  for (const asset of entities.assets) {
    if (isFuzzyMatch(chipLabel, asset.name)) {
      if (!context?.propertyId || asset.property_id === context.propertyId) {
        if (!context?.spaceId || !asset.space_id || asset.space_id === context.spaceId) {
          matches.push({ id: asset.id, label: asset.name, type: 'asset' });
        }
      }
    }
  }
  
  // Match categories
  for (const category of entities.categories) {
    if (isFuzzyMatch(chipLabel, category.name)) {
      matches.push({ id: category.id, label: category.name, type: 'category' });
    }
  }
  
  return matches;
}

