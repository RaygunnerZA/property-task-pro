import { useParams } from "react-router-dom";
import { ReviewLayout } from "@/components/reviewer/ReviewLayout";
import { useReview } from "@/hooks/useReview";
import { LoadingState } from "@/components/design-system/LoadingState";
import { EmptyState } from "@/components/design-system/EmptyState";
import { FileQuestion } from "lucide-react";

export default function ReviewWorkspace() {
  const { reviewId } = useParams<{ reviewId: string }>();
  const { review, loading, isError } = useReview(reviewId || "");

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <LoadingState message="Loading review…" />
      </div>
    );
  }

  if (isError || !review) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-6">
        <EmptyState
          icon={FileQuestion}
          title="Review not found"
          description="This review may have been completed or removed."
        />
      </div>
    );
  }

  return <ReviewLayout review={review} />;
}
