import { useParams } from 'react-router-dom';
import { usePropertyCompliance } from '@/hooks/usePropertyCompliance';
import { StandardPageWithBack } from '@/components/design-system/StandardPageWithBack';
import { LoadingState } from '@/components/design-system/LoadingState';
import { Card } from '@/components/ui/card';
import { Shield } from 'lucide-react';

export default function PropertyCompliance() {
  const { id } = useParams<{ id: string }>();
  const { compliance, loading } = usePropertyCompliance(id || '');

  return (
    <StandardPageWithBack
      title="Property Compliance"
      backTo={`/properties/${id}`}
      icon={<Shield className="h-6 w-6" />}
      maxWidth="lg"
    >
      {loading ? (
        <LoadingState message="Loading property compliance..." />
      ) : (
        <Card className="p-8 shadow-e1">
          <p className="text-muted-foreground">Property ID: {id}</p>
        </Card>
      )}
    </StandardPageWithBack>
  );
}
