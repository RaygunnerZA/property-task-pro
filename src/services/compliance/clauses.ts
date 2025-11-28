import { supabase } from '../supabase/client';
import { tryCatch } from '../../lib/async';

export const complianceClauses = {
  async getClausesBySource(sourceId: string) {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('compliance_clauses')
        .select('*')
        .eq('version_id', null)   // versioning later
        .eq('rule_id', null);     // rule linking later
      if (error) throw error;
      return data;
    });
  },

  async updateClauseCriticFields(result: any) {
    return tryCatch(async () => {
      const { clause, flagged, notes, reasons, suggested_category, rewrite } = result;

      const { error } = await supabase
        .from('compliance_clauses')
        .update({
          flagged,
          critic_notes: notes,
          category: suggested_category ?? clause.category
        })
        .eq('id', clause.id);

      if (error) throw error;
      return true;
    });
  }
};
