import { supabase } from '@/integrations/supabase/client';
import { tryCatch } from '../../lib/async';

export const remindersService = {
  async getReminders(orgId: string) {
    return tryCatch(async () => {
      // Note: 'reminders' table does not exist in schema - using signals instead
      const { data, error } = await supabase
        .from('signals' as any)
        .select('*')
        .eq('organisation_id', orgId)
        .eq('type', 'reminder');
      if (error) throw error;
      return data || [];
    });
  },
};
