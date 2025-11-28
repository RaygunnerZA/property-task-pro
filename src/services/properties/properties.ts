import { supabase } from '../supabase/client';
import { tryCatch } from '../../lib/async';

export const propertiesService = {
  async getProperties(orgId: string) {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('org_id', orgId);
      if (error) throw error;
      return data;
    });
  },
};
