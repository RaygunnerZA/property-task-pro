import { useQuery } from "@tanstack/react-query";
import { loadReviewWorkspace } from "@/services/compliance/reviewWorkspace";

export function useReview(reviewId: string) {
  const { data: review, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["compliance-review", reviewId],
    queryFn: async () => {
      if (!reviewId) return null;
      return loadReviewWorkspace(reviewId);
    },
    enabled: !!reviewId,
    staleTime: 30_000,
  });

  return { review: review ?? null, loading: isLoading, isError, error, refetch };
}
