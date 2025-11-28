import { supabase } from '../supabase/client';
import { tryCatch } from '../../lib/async';

export const complianceRules = {
  async getRule(id: string) {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('compliance_rules')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    });
  },
};
