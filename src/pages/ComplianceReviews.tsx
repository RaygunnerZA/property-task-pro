import { Surface, Heading, Text } from '@/components/filla';
import { usePendingReviews } from '@/hooks/usePendingReviews';

export default function ComplianceReviews() {
  const { reviews, loading } = usePendingReviews();

  return (
    <div className="min-h-screen bg-paper p-6">
      <div className="max-w-6xl mx-auto">
        <Heading variant="xl" className="mb-6">Pending Reviews</Heading>
        
        {loading ? (
          <Text variant="muted">Loading reviews...</Text>
        ) : (
          <div className="grid gap-4">
            {reviews.length === 0 ? (
              <Surface variant="neomorphic" className="p-8 text-center">
                <Text variant="muted">No pending reviews</Text>
              </Surface>
            ) : (
              reviews.map((review: any) => (
                <Surface key={review.id} variant="neomorphic" className="p-6">
                  <Text>{review.id}</Text>
                </Surface>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
