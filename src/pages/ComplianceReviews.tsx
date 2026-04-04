import { Link } from "react-router-dom";
import { usePendingReviews } from "@/hooks/usePendingReviews";
import { StandardPage } from "@/components/design-system/StandardPage";
import { LoadingState } from "@/components/design-system/LoadingState";
import { EmptyState } from "@/components/design-system/EmptyState";
import { Card } from "@/components/ui/card";
import { FileCheck, ArrowRight } from "lucide-react";
import { NeomorphicButton } from "@/components/design-system/NeomorphicButton";

export default function ComplianceReviews() {
  const { reviews, loading, isError } = usePendingReviews();

  return (
    <StandardPage
      title="Pending Reviews"
      icon={<FileCheck className="h-6 w-6" />}
      maxWidth="lg"
    >
      {loading ? (
        <LoadingState message="Loading reviews..." />
      ) : isError ? (
        <EmptyState
          icon={FileCheck}
          title="Could not load reviews"
          description="Check your connection and try again."
        />
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={FileCheck}
          title="No pending reviews"
          description="All reviews are up to date"
        />
      ) : (
        <div className="grid gap-4">
          {reviews.map((review: Record<string, unknown> & { id: string }) => (
            <Card key={review.id} className="p-6 shadow-e1">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Review
                  </p>
                  <p className="font-medium text-foreground">{review.id}</p>
                  {review.status != null && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Status: {String(review.status)}
                    </p>
                  )}
                  {typeof review.notes === "string" && review.notes.trim() && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {review.notes}
                    </p>
                  )}
                </div>
                <Link to={`/compliance/reviews/${review.id}`}>
                  <NeomorphicButton size="sm" className="w-full sm:w-auto">
                    Open workspace
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </NeomorphicButton>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </StandardPage>
  );
}
