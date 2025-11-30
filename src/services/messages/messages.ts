import { supabase } from '../supabase/client';
import { tryCatch } from '../../lib/async';

export const messagesService = {
  async getMessages(orgId: string) {
    return tryCatch(async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('org_id', orgId);
      if (error) throw error;
      return data;
    });
  },
};
