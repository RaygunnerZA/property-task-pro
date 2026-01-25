/**
 * Learning Hook - Phase 3
 * 
 * Provides functions to record learning events from user actions.
 * This hook does NOT change any UI - it only records learning events
 * in the background.
 * 
 * The system learns from explicit user actions only:
 * - Chip confirmations (user keeps fact)
 * - Chip rejections (user removes chip)
 * - ADD / CREATE / INVITE actions
 * - Manual entity selection
 */

import { useCallback, useRef } from 'react';
import { useActiveOrg } from './useActiveOrg';
import { supabase } from '@/integrations/supabase/client';
import {
  recordLearningEvent,
  confirmChip,
  rejectChip,
  recordEntitySelection,
  type LearningEventType,
  type ExtractedChip,
  type ChipType,
  type ExtractionSource,
} from '@/resolver';

// =============================================================================
// AI Usage Tracking (Internal Only)
// =============================================================================

interface AIUsageStats {
  taskId: string | null;
  aiCalls: number;
  ruleResolutions: number;
  fuzzyResolutions: number;
  memoryResolutions: number;
  aiResolutions: number;
}

// =============================================================================
// Hook
// =============================================================================

export interface UseLearningOptions {
  propertyId?: string;
}

export interface UseLearningReturn {
  /**
   * Record that user confirmed a chip (kept it as fact).
   * IMPORTANT: Only call this on task submission, not during editing.
   * @internal Use onTaskSubmitted instead for task creation flow.
   */
  onChipConfirmed: (chip: ExtractedChip) => Promise<void>;
  /** Record that user rejected a chip (removed it) */
  onChipRejected: (chip: ExtractedChip) => Promise<void>;
  /** Record that user selected an entity manually */
  onEntitySelected: (rawText: string, entityType: ChipType, entityId: string) => Promise<void>;
  /** Record that user created a new entity via ADD/CREATE/INVITE */
  onEntityCreated: (rawText: string, entityType: ChipType, entityId: string) => Promise<void>;
  /** Record that user changed an entity (override A with B) */
  onEntityOverridden: (rawText: string, entityType: ChipType, newEntityId: string, previousEntityId: string) => Promise<void>;
  /** Track AI usage for internal metrics */
  trackAIUsage: (layer: 'rule' | 'fuzzy' | 'memory' | 'ai') => void;
  /** Get current AI usage stats */
  getAIUsageStats: () => AIUsageStats;
}

export function useLearning(options: UseLearningOptions = {}): UseLearningReturn {
  const { orgId } = useActiveOrg();
  const { propertyId } = options;

  // Track AI usage per task session
  const usageStatsRef = useRef<AIUsageStats>({
    taskId: null,
    aiCalls: 0,
    ruleResolutions: 0,
    fuzzyResolutions: 0,
    memoryResolutions: 0,
    aiResolutions: 0,
  });

  // Get current user ID
  const getUserId = useCallback(async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  }, []);

  /**
   * Record that user confirmed a chip (kept it as fact).
   * 
   * CRITICAL: Only call this on task submission, not during editing.
   * Calling during editing causes false training if user abandons task.
   * 
   * @internal Prefer using onTaskSubmitted for task creation flow.
   */
  const onChipConfirmed = useCallback(async (chip: ExtractedChip): Promise<void> => {
    if (!orgId || !chip.resolvedEntityId) return;

    const userId = await getUserId();
    if (!userId) return;

    try {
      await confirmChip(orgId, userId, chip, propertyId);
      if (import.meta.env.DEV) {
        console.debug('[Learning] Chip confirmed:', chip.type, chip.label);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.debug('[Learning] Failed to record confirmation:', err);
      }
    }
  }, [orgId, propertyId, getUserId]);

  /**
   * Record that user rejected a chip (removed it)
   */
  const onChipRejected = useCallback(async (chip: ExtractedChip): Promise<void> => {
    if (!orgId || !chip.resolvedEntityId) return;

    const userId = await getUserId();
    if (!userId) return;

    try {
      await rejectChip(orgId, userId, chip, propertyId);
      if (import.meta.env.DEV) {
        console.debug('[Learning] Chip rejected:', chip.type, chip.label);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.debug('[Learning] Failed to record rejection:', err);
      }
    }
  }, [orgId, propertyId, getUserId]);

  /**
   * Record that user selected an entity manually
   */
  const onEntitySelected = useCallback(async (
    rawText: string,
    entityType: ChipType,
    entityId: string
  ): Promise<void> => {
    if (!orgId) return;

    const userId = await getUserId();
    if (!userId) return;

    try {
      await recordEntitySelection(orgId, userId, rawText, entityType, entityId, propertyId);
      if (import.meta.env.DEV) {
        console.debug('[Learning] Entity selected:', entityType, rawText);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.debug('[Learning] Failed to record selection:', err);
      }
    }
  }, [orgId, propertyId, getUserId]);

  /**
   * Record that user created a new entity via ADD/CREATE/INVITE
   */
  const onEntityCreated = useCallback(async (
    rawText: string,
    entityType: ChipType,
    entityId: string
  ): Promise<void> => {
    if (!orgId) return;

    const userId = await getUserId();
    if (!userId) return;

    try {
      await recordLearningEvent({
        type: 'create',
        orgId,
        userId,
        propertyId,
        rawText,
        entityType,
        entityId,
        source: 'user',
      });
      if (import.meta.env.DEV) {
        console.debug('[Learning] Entity created:', entityType, rawText);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.debug('[Learning] Failed to record creation:', err);
      }
    }
  }, [orgId, propertyId, getUserId]);

  /**
   * Record that user changed an entity (override A with B)
   */
  const onEntityOverridden = useCallback(async (
    rawText: string,
    entityType: ChipType,
    newEntityId: string,
    previousEntityId: string
  ): Promise<void> => {
    if (!orgId) return;

    const userId = await getUserId();
    if (!userId) return;

    try {
      await recordLearningEvent({
        type: 'override',
        orgId,
        userId,
        propertyId,
        rawText,
        entityType,
        entityId: newEntityId,
        source: 'user',
        previousEntityId,
      });
      if (import.meta.env.DEV) {
        console.debug('[Learning] Entity overridden:', entityType, rawText);
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.debug('[Learning] Failed to record override:', err);
      }
    }
  }, [orgId, propertyId, getUserId]);

  /**
   * Track AI usage for internal metrics (no network call)
   */
  const trackAIUsage = useCallback((layer: 'rule' | 'fuzzy' | 'memory' | 'ai'): void => {
    const stats = usageStatsRef.current;
    switch (layer) {
      case 'rule':
        stats.ruleResolutions++;
        break;
      case 'fuzzy':
        stats.fuzzyResolutions++;
        break;
      case 'memory':
        stats.memoryResolutions++;
        break;
      case 'ai':
        stats.aiCalls++;
        stats.aiResolutions++;
        break;
    }
    
    // Log AI usage reduction metrics (DEV only)
    if (import.meta.env.DEV && layer !== 'ai') {
      const totalNonAI = stats.ruleResolutions + stats.fuzzyResolutions + stats.memoryResolutions;
      const total = totalNonAI + stats.aiResolutions;
      if (total > 0) {
        const aiReductionRate = ((totalNonAI / total) * 100).toFixed(1);
        console.debug('[AIUsage] Resolution stats:', {
          ...stats,
          aiReductionRate: `${aiReductionRate}%`,
        });
      }
    }
  }, []);

  /**
   * Get current AI usage stats
   */
  const getAIUsageStats = useCallback((): AIUsageStats => {
    return { ...usageStatsRef.current };
  }, []);

  return {
    onChipConfirmed,
    onChipRejected,
    onEntitySelected,
    onEntityCreated,
    onEntityOverridden,
    trackAIUsage,
    getAIUsageStats,
  };
}

// =============================================================================
// Convenience: Create learning context for a task creation session
// =============================================================================

export interface TaskLearningContext {
  /** Called when task is submitted with confirmed chips */
  onTaskSubmitted: (confirmedChips: ExtractedChip[]) => Promise<void>;
  /** Called when user removes a chip during task creation */
  onChipRemoved: (chip: ExtractedChip) => Promise<void>;
}

export function useTaskLearning(options: UseLearningOptions = {}): TaskLearningContext & UseLearningReturn {
  const learning = useLearning(options);

  /**
   * Called when task is submitted - confirm all chips that were kept.
   * 
   * This is the ONLY place confirmations should be recorded.
   * Learning = explicit commitment only (task submission).
   */
  const onTaskSubmitted = useCallback(async (confirmedChips: ExtractedChip[]): Promise<void> => {
    // Confirm all chips that have resolved entities
    const confirmPromises = confirmedChips
      .filter(chip => chip.resolvedEntityId)
      .map(chip => learning.onChipConfirmed(chip));

    await Promise.allSettled(confirmPromises);
    
    if (import.meta.env.DEV) {
      console.debug('[Learning] Task submitted with', confirmedChips.length, 'confirmed chips');
    }
  }, [learning]);

  /**
   * Called when user removes a chip during task creation
   */
  const onChipRemoved = useCallback(async (chip: ExtractedChip): Promise<void> => {
    await learning.onChipRejected(chip);
  }, [learning]);

  return {
    ...learning,
    onTaskSubmitted,
    onChipRemoved,
  };
}
