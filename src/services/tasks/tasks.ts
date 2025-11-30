import { supabase } from '../supabase/client';
import { tryCatch } from '../../lib/async';

export const tasksService = {
  async getTasks(orgId: string) {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('org_id', orgId);
      if (error) throw error;
      return data;
    });
  },
};
