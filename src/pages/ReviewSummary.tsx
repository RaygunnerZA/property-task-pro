import { useParams } from 'react-router-dom';
import { useReview } from '@/hooks/useReview';
import { StandardPageWithBack } from '@/components/design-system/StandardPageWithBack';
import { LoadingState } from '@/components/design-system/LoadingState';
import { Card } from '@/components/ui/card';
import { FileCheck } from 'lucide-react';

export default function ReviewSummary() {
  const { reviewId } = useParams<{ reviewId: string }>();
  const { review, loading } = useReview(reviewId || '');

  return (
    <StandardPageWithBack
      title="Review Summary"
      backTo="/compliance"
      icon={<FileCheck className="h-6 w-6" />}
      maxWidth="lg"
    >
      {loading ? (
        <LoadingState message="Loading summary..." />
      ) : (
        <Card className="p-8 shadow-e1">
          <p className="text-muted-foreground">Review ID: {reviewId}</p>
        </Card>
      )}
    </StandardPageWithBack>
  );
}
