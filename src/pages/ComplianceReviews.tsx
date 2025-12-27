import { usePendingReviews } from '@/hooks/usePendingReviews';
import { StandardPage } from '@/components/design-system/StandardPage';
import { LoadingState } from '@/components/design-system/LoadingState';
import { EmptyState } from '@/components/design-system/EmptyState';
import { Card } from '@/components/ui/card';
import { FileCheck } from 'lucide-react';

export default function ComplianceReviews() {
  const { reviews, loading } = usePendingReviews();

  return (
    <StandardPage
      title="Pending Reviews"
      icon={<FileCheck className="h-6 w-6" />}
      maxWidth="lg"
    >
      {loading ? (
        <LoadingState message="Loading reviews..." />
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={FileCheck}
          title="No pending reviews"
          description="All reviews are up to date"
        />
      ) : (
        <div className="grid gap-4">
          {reviews.map((review: any) => (
            <Card key={review.id} className="p-6 shadow-e1">
              <p className="text-foreground">{review.id}</p>
            </Card>
          ))}
        </div>
      )}
    </StandardPage>
  );
}
