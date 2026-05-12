import { supabase as _supabase } from '@/integrations/supabase/client';
// pending-migration tables — cast until schema is generated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;
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
