/**
 * Resolution Memory Service
 * Persists resolved mappings in database (org-scoped)
 * Enables Filla to feel smarter over time
 */

import { supabase } from '@/integrations/supabase/client';
import { EntityType } from '@/types/chip-suggestions';

export interface ResolutionMemoryEntry {
  id: string;
  org_id: string;
  key: string; // e.g., "the accountant"
  entity_type: EntityType;
  entity_id: string;
  confidence: number;
  updated_at: string;
}

/**
 * Get resolution memory for a key and entity type
 */
export async function getResolutionMemory(
  orgId: string,
  key: string,
  entityType: EntityType
): Promise<ResolutionMemoryEntry | null> {
  const { data, error } = await supabase
    .from('ai_resolution_memory')
    .select('*')
    .eq('org_id', orgId)
    .eq('key', key.toLowerCase().trim())
    .eq('entity_type', entityType)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('Error fetching resolution memory:', error);
    return null;
  }

  return data;
}

/**
 * Store or update resolution memory
 */
export async function storeResolutionMemory(
  orgId: string,
  key: string,
  entityType: EntityType,
  entityId: string,
  confidence: number = 0.5
): Promise<void> {
  const { error } = await supabase
    .from('ai_resolution_memory')
    .upsert({
      org_id: orgId,
      key: key.toLowerCase().trim(),
      entity_type: entityType,
      entity_id: entityId,
      confidence,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'org_id,key,entity_type'
    });

  if (error) {
    console.error('Error storing resolution memory:', error);
    throw error;
  }
}

/**
 * Query memory before running resolution pipeline
 */
export async function queryResolutionMemory(
  orgId: string,
  key: string,
  entityType: EntityType
): Promise<string | null> {
  const memory = await getResolutionMemory(orgId, key, entityType);
  return memory?.entity_id || null;
}

