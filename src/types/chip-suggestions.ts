/**
 * AI Chip Suggestion Types
 * Used by the Create Task modal's intelligent chip suggestion engine
 */

export type ChipType = 'space' | 'person' | 'team' | 'priority' | 'category' | 'theme' | 'compliance' | 'date' | 'asset' | 'recurrence' | 'property';

export type PriorityValue = 'low' | 'medium' | 'high' | 'urgent';

export type ChipState = 'suggested' | 'applied' | 'resolved' | 'blocked';

export type EntityType = 'person' | 'team' | 'space' | 'asset' | 'category' | 'subcategory' | 'property';

export type ResolutionSource = 'exact' | 'fuzzy' | 'user_choice' | 'created';

export interface SuggestedChip {
  id: string;
  type: ChipType;
  value: string;
  label: string;
  score: number; // 0-1, chips with score >= 0.5 are shown
  source: 'rule' | 'vector' | 'ai' | 'fallback';
  metadata?: Record<string, unknown>;
  // Resolution Truth Model fields
  state?: ChipState;
  resolvedEntityId?: string; // Real entity ID when resolved
  resolvedEntityType?: EntityType;
  resolutionSource?: ResolutionSource;
  resolutionConfidence?: number; // 0-1
  blockingRequired?: boolean; // If true, task creation blocked until resolved
}

export interface GhostCategory {
  id: string;
  name: string;
  reason: 'space' | 'assignee' | 'urgency' | 'compliance' | 'historical' | 'repeat';
  score: number;
}

// Alias for backward compatibility
export type GhostGroup = GhostCategory;

export interface ChipSuggestionContext {
  description: string;
  propertyId?: string;
  selectedSpaceIds?: string[];
  selectedPersonId?: string;
  selectedTeamIds?: string[];
  imageOcrText?: string;
  originalText?: string; // Original text with capitalization preserved for person/property detection
}

export interface ChipSuggestionResult {
  chips: SuggestedChip[];
  ghostCategories: GhostCategory[];
  suggestedTitle?: string;
  complianceMode: boolean;
}

// Rule-based extraction patterns
export interface ExtractionPatterns {
  urgencyKeywords: string[];
  lowPriorityKeywords: string[];
  complianceKeywords: string[];
  assetToSpaceMap: Record<string, string[]>;
  datePatterns: RegExp[];
  assetKeywords: string[];
}

// Prepared types for future vector/AI integration
export interface TaskEmbedding {
  id: string;
  task_id: string;
  embedding: number[]; // vector(1536) - for future use
  metadata: {
    description?: string;
    property_id?: string;
    space_ids?: string[];
    assigned_user_id?: string;
    priority?: PriorityValue;
  };
}

export interface AIExtractionResult {
  suggested_title?: string;
  chips: Array<{
    type: ChipType;
    value: string;
    confidence: number;
  }>;
}
