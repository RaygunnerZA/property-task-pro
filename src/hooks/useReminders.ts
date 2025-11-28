import { useEffect, useState } from 'react';
import { remindersService } from '../services/reminders/reminders';

export function useReminders(orgId: string) {
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    remindersService.getReminders(orgId).then(({ data, error }) => {
      setReminders(data ?? []);
      setError(error);
      setLoading(false);
    });
  }, [orgId]);

  return { reminders, loading, error };
}
