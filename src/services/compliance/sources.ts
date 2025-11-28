import { supabase } from '../supabase/client';
import { tryCatch } from '../../lib/async';
import { ComplianceSourceCreateInput } from '../../types/compliance-entities';

export const complianceSources = {
  async createSource(payload: ComplianceSourceCreateInput) {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('compliance_sources')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  },
};
