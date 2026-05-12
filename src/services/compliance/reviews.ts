import { supabase as _supabase } from '@/integrations/supabase/client';
import { tryCatch } from '../../lib/async';
// compliance_reviews is a pending-migration table — cast until generated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

export const complianceReviews = {
  async getById(reviewId: string) {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from("compliance_reviews")
        .select("*")
        .eq("id", reviewId)
        .single();
      if (error) throw error;
      return data;
    });
  },

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
        })
        .eq('id', reviewId);

      if (error) throw error;
      return true;
    });
  }
};
