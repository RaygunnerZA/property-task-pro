import { supabase } from '../supabase/client';
import { tryCatch } from '../../lib/async';

export const jobHelpers = {
  async markJobError(jobId: string, message: string) {
    return tryCatch(async () => {
      const { error } = await supabase
        .from('compliance_jobs')
        .update({ status: 'error', error_message: message })
        .eq('id', jobId);
      if (error) throw error;
      return true;
    });
  }
};
