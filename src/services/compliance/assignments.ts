import { supabase as _supabase } from '@/integrations/supabase/client';
// pending-migration tables — cast until schema is generated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;
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
