/**
 * Resolution Audit Service
 * Append-only logging for AI resolutions
 * Enables trust, debugging, compliance later
 */

import { supabase } from '@/integrations/supabase/client';
import { track } from '@/lib/analytics';

export interface ResolutionAuditEntry {
  org_id: string;
  user_id: string;
  task_temp_id?: string;
  suggestion_payload: Record<string, unknown>;
  chosen_payload: Record<string, unknown>;
}

/**
 * Log AI resolution for audit
 */
export async function logResolutionAudit(
  entry: ResolutionAuditEntry
): Promise<void> {
  const { error } = await supabase
    .from('ai_resolution_audit')
    .insert({
      ...entry,
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Error logging resolution audit:', error);
    // Don't throw - audit failures shouldn't break the flow
  }
}

/**
 * Log chip resolution and fire the corresponding analytics event.
 * outcome: 'accepted' — user kept the AI suggestion unchanged
 *          'edited'   — user modified the suggestion before accepting
 *          'rejected' — user removed the suggestion
 */
export async function logChipResolution(
  orgId: string,
  userId: string,
  suggestion: Record<string, unknown>,
  chosen: Record<string, unknown>,
  taskTempId?: string,
  outcome: 'accepted' | 'edited' | 'rejected' = 'accepted'
): Promise<void> {
  await logResolutionAudit({
    org_id: orgId,
    user_id: userId,
    task_temp_id: taskTempId,
    suggestion_payload: suggestion,
    chosen_payload: chosen,
  });

  const eventMap = {
    accepted: 'ai_suggestion_accepted',
    edited: 'ai_suggestion_edited',
    rejected: 'ai_suggestion_rejected',
  } as const;

  track(eventMap[outcome], {
    org_id: orgId,
    suggestion_type: suggestion.type ?? suggestion.chip ?? 'unknown',
  });
}

