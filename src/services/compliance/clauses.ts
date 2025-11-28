import { supabase } from '../supabase/client';
import { tryCatch } from '../../lib/async';

export const complianceClauses = {
  async getClausesForRule(ruleId: string) {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('compliance_clauses')
        .select('*')
        .eq('rule_id', ruleId);
      if (error) throw error;
      return data;
    });
  },
};
