import { useEffect, useState } from 'react';
import { messagesService } from '../services/messages/messages';

export function useMessages(orgId: string) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    messagesService.getMessages(orgId).then(({ data, error }) => {
      setMessages(data ?? []);
      setError(error);
      setLoading(false);
    });
  }, [orgId]);

  return { messages, loading, error };
}
