import { supabase } from '@/integrations/supabase/client';
import { tryCatch } from '../../lib/async';
import { complianceClauses } from './clauses';

export const versioningService = {
  async createVersion(ruleId: string, orgId: string, versionNumber: number = 1) {
    return tryCatch(async () => {
      const { data: version, error } = await supabase
        .from('compliance_rule_versions')
        .insert({ rule_id: ruleId, org_id: orgId, version_number: versionNumber })
        .select()
        .single();
      if (error) throw error;
      return version;
    });
  },

  async bindClauses(ruleId: string, versionId: string) {
    return complianceClauses.bindClausesToVersion(ruleId, versionId);
  }
};
