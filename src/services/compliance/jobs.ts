import { supabase as _supabase } from '@/integrations/supabase/client';
import { tryCatch } from '../../lib/async';
// compliance_jobs is a pending-migration table — cast until generated
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = _supabase as any;

export const complianceJobs = {
  async createJob(payload: { org_id: string; source_id: string; type: string }) {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('compliance_jobs')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    });
  },

  async updateJobStatus(jobId: string, status: string) {
    return tryCatch(async () => {
      const { error } = await supabase
        .from('compliance_jobs')
        .update({ status })
        .eq('id', jobId);
      if (error) throw error;
      return true;
    });
  }
};
