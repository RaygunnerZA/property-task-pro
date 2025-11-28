import { supabase } from '../supabase/client';
import { tryCatch } from '../../lib/async';

export const complianceReviews = {
  async getPendingReviews() {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('compliance_reviews')
        .select('*')
        .eq('status', 'pending_review');
      if (error) throw error;
      return data;
    });
  },
};
