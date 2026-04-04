import { useQuery } from "@tanstack/react-query";
import { complianceReviews } from "@/services/compliance/reviews";

export function usePendingReviews() {
  const { data: reviews = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["compliance-pending-reviews"],
    queryFn: async () => {
      const { data, error: e } = await complianceReviews.getPendingReviews();
      if (e) throw new Error(e);
      return data ?? [];
    },
    staleTime: 30_000,
  });

  return { reviews, loading: isLoading, isError, error, refetch };
}
