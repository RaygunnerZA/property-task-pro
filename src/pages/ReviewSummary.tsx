import { useParams } from 'react-router-dom';
import { Surface, Heading, Text } from '@/components/filla';
import { useReview } from '@/hooks/useReview';

export default function ReviewSummary() {
  const { reviewId } = useParams<{ reviewId: string }>();
  const { review, loading } = useReview(reviewId || '');

  return (
    <div className="min-h-screen bg-paper p-6">
      <div className="max-w-4xl mx-auto">
        <Heading variant="xl" className="mb-6">Review Summary</Heading>
        
        {loading ? (
          <Text variant="muted">Loading summary...</Text>
        ) : (
          <Surface variant="neomorphic" className="p-8">
            <Text variant="muted">Review ID: {reviewId}</Text>
          </Surface>
        )}
      </div>
    </div>
  );
}
