import { supabase } from '@/integrations/supabase/client';
import { tryCatch } from '../../lib/async';

export const propertyCompliance = {
  async assignVersionToAllProperties(orgId: string, versionId: string) {
    return tryCatch(async () => {
      const { data: properties, error: propErr } = await supabase
        .from('properties')
        .select('id')
        .eq('org_id', orgId);
      if (propErr) throw propErr;

      const payload = properties.map((p: any) => ({
        org_id: orgId,
        property_id: p.id,
        rule_version_id: versionId,
        status: 'pending'
      }));

      const { error } = await supabase
        .from('property_compliance_status')
        .insert(payload);
      if (error) throw error;

      return true;
    });
  },

  async markOutdatedVersions(orgId: string, ruleId: string, latestVersionId: string) {
    return tryCatch(async () => {
      // Note: property_compliance_status doesn't have rule_id field, only rule_version_id
      const { error } = await supabase
        .from('property_compliance_status')
        .update({ status: 'pending' })
        .eq('org_id', orgId)
        .neq('rule_version_id', latestVersionId);
      if (error) throw error;
      return true;
    });
  }
};
