/**
 * AI Chip Suggestion Types
 * Used by the Create Task modal's intelligent chip suggestion engine
 */

export type ChipType = 'space' | 'person' | 'team' | 'priority' | 'category' | 'theme' | 'compliance' | 'date';

export type PriorityValue = 'low' | 'medium' | 'high' | 'urgent';

export interface SuggestedChip {
  id: string;
  type: ChipType;
  value: string;
  label: string;
  score: number; // 0-1, chips with score >= 0.5 are shown
  source: 'rule' | 'vector' | 'ai' | 'fallback';
  metadata?: Record<string, unknown>;
}

export interface GhostCategory {
  id: string;
  name: string;
  reason: 'space' | 'assignee' | 'urgency' | 'compliance' | 'historical' | 'repeat';
  score: number;
}

export interface ChipSuggestionContext {
  description: string;
  propertyId?: string;
  selectedSpaceIds?: string[];
  selectedPersonId?: string;
  selectedTeamIds?: string[];
  imageOcrText?: string;
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
