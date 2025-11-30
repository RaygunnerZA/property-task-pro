import { supabase } from '@/integrations/supabase/client';
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

  async createRule(payload: { org_id: string; title: string; description: string; source_id: string }) {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('compliance_rules')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  },

  async updateRuleStatus(ruleId: string, status: string) {
    return tryCatch(async () => {
      const { error } = await supabase
        .from('compliance_rules')
        .update({ status })
        .eq('id', ruleId);
      if (error) throw error;
      return true;
    });
  },

  async linkSourceToRule(ruleId: string, sourceId: string) {
    return tryCatch(async () => {
      const { error } = await supabase
        .from('compliance_rules')
        .update({ source_id: sourceId })
        .eq('id', ruleId);
      if (error) throw error;
      return true;
    });
  }
};
