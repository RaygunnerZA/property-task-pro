import { supabase } from '@/integrations/supabase/client';
import { tryCatch } from '../../lib/async';

export const propertiesService = {
  async getProperties(orgId: string) {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('org_id', orgId)
        .eq('is_archived', false);
      if (error) throw error;
      return data;
    });
  },

  async deleteProperty(propertyId: string) {
    return tryCatch(async () => {
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', propertyId);
      if (error) throw error;
      return true;
    });
  },

  async archiveProperty(propertyId: string) {
    return tryCatch(async () => {
      const { error } = await supabase
        .from('properties')
        .update({ is_archived: true })
        .eq('id', propertyId);
      if (error) throw error;
      return true;
    });
  },
};
