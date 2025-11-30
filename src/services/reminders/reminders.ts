import { supabase } from '../supabase/client';
import { tryCatch } from '../../lib/async';

export const remindersService = {
  async getReminders(orgId: string) {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('org_id', orgId);
      if (error) throw error;
      return data;
    });
  },
};
