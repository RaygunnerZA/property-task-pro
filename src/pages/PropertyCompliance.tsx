import { useParams } from 'react-router-dom';
import { Surface, Heading, Text } from '@/components/filla';
import { usePropertyCompliance } from '@/hooks/usePropertyCompliance';

export default function PropertyCompliance() {
  const { id } = useParams<{ id: string }>();
  const { compliance, loading } = usePropertyCompliance(id || '');

  return (
    <div className="min-h-screen bg-paper p-6">
      <div className="max-w-6xl mx-auto">
        <Heading variant="xl" className="mb-6">Property Compliance</Heading>
        
        {loading ? (
          <Text variant="muted">Loading property compliance...</Text>
        ) : (
          <Surface variant="neomorphic" className="p-8">
            <Text variant="muted">Property ID: {id}</Text>
          </Surface>
        )}
      </div>
    </div>
  );
}
