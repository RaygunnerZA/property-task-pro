import { useParams } from 'react-router-dom';
import { ReviewLayout } from '@/components/reviewer/ReviewLayout';
import { useReview } from '@/hooks/useReview';

export default function ReviewWorkspace() {
  const { reviewId } = useParams<{ reviewId: string }>();
  const { review, loading } = useReview(reviewId || '');

  if (loading) {
    return <div className="min-h-screen bg-paper flex items-center justify-center">Loading...</div>;
  }

  return <ReviewLayout review={review} />;
}
