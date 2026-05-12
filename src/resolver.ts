/**
 * Resolver module — stub implementation for learning/resolution API.
 * Full implementation is pending; these stubs allow the codebase to compile cleanly.
 */

export type { ChipType } from '@/types/chip-suggestions';
export type { SuggestedChip as ExtractedChip } from '@/types/chip-suggestions';

export type ExtractionSource =
  | 'memory'
  | 'exact'
  | 'fuzzy'
  | 'user_choice'
  | 'created'
  | 'ai'
  | 'rule'
  | 'fallback';

export type LearningEventType =
  | 'create'
  | 'override'
  | 'confirm'
  | 'reject'
  | 'select'
  | 'submit';

import type { SuggestedChip } from '@/types/chip-suggestions';

export async function confirmChip(
  _orgId: string,
  _userId: string,
  _chip: SuggestedChip,
  _propertyId?: string | null
): Promise<void> {}

export async function rejectChip(
  _orgId: string,
  _userId: string,
  _chip: SuggestedChip,
  _propertyId?: string | null
): Promise<void> {}

export async function recordEntitySelection(
  _orgId: string,
  _userId: string,
  _rawText: string,
  _entityType: string,
  _entityId: string,
  _propertyId?: string | null
): Promise<void> {}

export async function recordLearningEvent(_event: {
  type: LearningEventType;
  orgId: string;
  [key: string]: unknown;
}): Promise<void> {}
