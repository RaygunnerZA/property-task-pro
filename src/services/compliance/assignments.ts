import { supabase } from '@/integrations/supabase/client';
import { tryCatch } from '../../lib/async';

export const complianceAssignments = {
  async getAssignmentsForProperty(propertyId: string) {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('property_compliance_status')
        .select('*')
        .eq('property_id', propertyId);
      if (error) throw error;
      return data;
    });
  }
};
