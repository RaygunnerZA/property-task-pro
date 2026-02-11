/**
 * Resolution Pipeline
 * Deterministic 5-step resolution for AI-suggested entities
 *
 * CHIP RESOLUTION BEHAVIOR (Defined):
 *
 * Steps:
 * 0. Memory  - Previously learned mapping → auto-resolve (confidence: 0.9)
 * 1. Exact   - Same ID → auto-resolve (confidence: 1.0)
 * 2. Fuzzy   - Case, plural, nickname, alias → auto-resolve (confidence: 0.85)
 * 3. Ambiguous - Multiple candidates → requires user choice (confidence: 0.7)
 * 4. Missing - Entity doesn't exist → requires creation (confidence: 0.0)
 *
 * RESOLUTION RULES:
 * - Verb chips (blockingRequired && !resolvedEntityId) must trigger panel opening
 * - "Add" chips (space/asset) open where/what panel for entity creation
 * - "Invite" chips (person) open who panel for person assignment/invitation
 * - Resolved chips become fact chips (metadata)
 * - Unresolved chips remain verb chips until resolved or removed
 *
 * ENTITY MATCHING:
 * - Memory: Org-scoped learned mapping from previous resolutions
 * - Exact: ID match or exact name match (case-insensitive)
 * - Fuzzy: Levenshtein similarity ≥ 80%, contains match, plural variations
 * - Context-aware: Filter by property_id for spaces/assets when available
 */

import { SuggestedChip, ChipType, EntityType, ResolutionSource } from '@/types/chip-suggestions';
import { isFuzzyMatchSimilarity } from './fuzzyMatch';
import { queryResolutionMemory, storeResolutionMemory } from './resolutionMemory';

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

// ─── Helpers ────────────────────────────────────────────────────

/** Map chip types to the entity types that support memory resolution. */
const CHIP_TO_ENTITY: Partial<Record<ChipType, EntityType>> = {
  person: 'person',
  team: 'team',
  space: 'space',
  asset: 'asset',
  category: 'category',
  theme: 'category',
};

/** Check whether a remembered entity still exists in the current entity list. */
function findEntityById(
  entityId: string,
  entities: AvailableEntities,
): { type: EntityType } | null {
  if (entities.spaces.some(s => s.id === entityId)) return { type: 'space' };
  if (entities.members.some(m => m.user_id === entityId || m.id === entityId)) return { type: 'person' };
  if (entities.teams.some(t => t.id === entityId)) return { type: 'team' };
  if (entities.assets.some(a => a.id === entityId)) return { type: 'asset' };
  if (entities.categories.some(c => c.id === entityId)) return { type: 'category' };
  return null;
}

// ─── Main Pipeline ──────────────────────────────────────────────

/**
 * Resolve a chip through the 5-step pipeline
 */
export async function resolveChip(
  chip: SuggestedChip,
  entities: AvailableEntities,
  context?: {
    propertyId?: string;
    spaceId?: string;
    orgId?: string;
  },
): Promise<ResolutionResult> {
  const entityType = CHIP_TO_ENTITY[chip.type] ?? null;

  // Step 0: Resolution Memory
  if (context?.orgId && entityType) {
    try {
      const memoryEntityId = await queryResolutionMemory(context.orgId, chip.label, entityType);
      if (memoryEntityId) {
        // Validate remembered entity still exists in the current set
        const validated = findEntityById(memoryEntityId, entities);
        if (validated) {
          return {
            resolved: true,
            entityId: memoryEntityId,
            entityType: validated.type,
            resolutionSource: 'memory',
            confidence: 0.9,
          };
        }
        // Entity no longer exists — fall through to normal pipeline
      }
    } catch {
      // Memory lookup failed — non-blocking, continue pipeline
    }
  }

  // Step 1: Exact Match
  if (chip.value && !chip.value.startsWith('ghost-')) {
    const exactMatch = findExactMatch(chip, entities, context);
    if (exactMatch) {
      // Fire-and-forget: persist for future lookups
      persistMemory(context?.orgId, chip.label, exactMatch.type, exactMatch.id, 1.0);
      return {
        resolved: true,
        entityId: exactMatch.id,
        entityType: exactMatch.type,
        resolutionSource: 'exact',
        confidence: 1.0,
      };
    }
  }

  // Step 2: Fuzzy Match
  const fuzzyMatches = findFuzzyMatches(chip, entities, context);
  if (fuzzyMatches.length === 1) {
    persistMemory(context?.orgId, chip.label, fuzzyMatches[0].type, fuzzyMatches[0].id, 0.85);
    return {
      resolved: true,
      entityId: fuzzyMatches[0].id,
      entityType: fuzzyMatches[0].type,
      resolutionSource: 'fuzzy',
      confidence: 0.85,
    };
  }

  // Step 3: Ambiguous (multiple candidates)
  if (fuzzyMatches.length > 1) {
    return {
      resolved: false,
      candidates: fuzzyMatches,
      requiresUserChoice: true,
      confidence: 0.7,
    };
  }

  // Step 4: Missing (no matches)
  return {
    resolved: false,
    requiresCreation: true,
    confidence: 0.0,
  };
}

/** Fire-and-forget helper — never throws. */
function persistMemory(
  orgId: string | undefined,
  label: string,
  entityType: EntityType,
  entityId: string,
  confidence: number,
): void {
  if (!orgId) return;
  storeResolutionMemory(orgId, label, entityType, entityId, confidence).catch(() => {
    // Non-blocking — memory storage failure must not break resolution
  });
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
 * Find fuzzy matches by name (uses consolidated similarity-based matching)
 */
function findFuzzyMatches(
  chip: SuggestedChip,
  entities: AvailableEntities,
  context?: { propertyId?: string; spaceId?: string },
): Array<{ id: string; label: string; type: EntityType }> {
  const matches: Array<{ id: string; label: string; type: EntityType }> = [];
  const chipLabel = chip.label;

  // Match spaces
  for (const space of entities.spaces) {
    if (isFuzzyMatchSimilarity(chipLabel, space.name)) {
      if (!context?.propertyId || space.property_id === context.propertyId) {
        matches.push({ id: space.id, label: space.name, type: 'space' });
      }
    }
  }

  // Match members
  for (const member of entities.members) {
    if (isFuzzyMatchSimilarity(chipLabel, member.display_name)) {
      matches.push({ id: member.user_id, label: member.display_name, type: 'person' });
    }
  }

  // Match teams
  for (const team of entities.teams) {
    if (isFuzzyMatchSimilarity(chipLabel, team.name)) {
      matches.push({ id: team.id, label: team.name, type: 'team' });
    }
  }

  // Match assets
  for (const asset of entities.assets) {
    if (asset.name && isFuzzyMatchSimilarity(chipLabel, asset.name)) {
      if (!context?.propertyId || asset.property_id === context.propertyId) {
        if (!context?.spaceId || !asset.space_id || asset.space_id === context.spaceId) {
          matches.push({ id: asset.id, label: asset.name, type: 'asset' });
        }
      }
    }
  }

  // Match categories
  for (const category of entities.categories) {
    if (isFuzzyMatchSimilarity(chipLabel, category.name)) {
      matches.push({ id: category.id, label: category.name, type: 'category' });
    }
  }

  return matches;
}

