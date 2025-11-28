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

  async createPendingReview(payload: { org_id: string; source_id: string; status: string }) {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('compliance_reviews')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  },

  async completeReview(reviewId: string, reviewerId: string) {
    return tryCatch(async () => {
      const { error } = await supabase
        .from('compliance_reviews')
        .update({
          status: 'approved',
          reviewer_id: reviewerId,
          completed_at: new Date().toISOString()
        })
        .eq('id', reviewId);

      if (error) throw error;
      return true;
    });
  }
};
