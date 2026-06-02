import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ensureOnboardingDemoForProperty } from "@/lib/seedOnboardingDemo";
import { propertyHasOnboardingDemoContent } from "@/lib/onboardingDemo";

/**
 * Seeds sample tasks/assets/compliance once per property when demo content is absent.
 */
export function useEnsureOnboardingDemo(
  propertyId: string | undefined,
  tasks: Array<{ property_id?: string | null; description?: string | null }>
) {
  const queryClient = useQueryClient();
  const attemptedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!propertyId) return;
    if (propertyHasOnboardingDemoContent(tasks, propertyId)) return;
    if (attemptedRef.current.has(propertyId)) return;
    attemptedRef.current.add(propertyId);

    void (async () => {
      const result = await ensureOnboardingDemoForProperty(propertyId);
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: ["tasks"] });
        void queryClient.invalidateQueries({ queryKey: ["assets"] });
        void queryClient.invalidateQueries({ queryKey: ["compliance_portfolio"] });
        void queryClient.invalidateQueries({ queryKey: ["space_documents"] });
        void queryClient.invalidateQueries({ queryKey: ["space_compliance"] });
      }
    })();
  }, [propertyId, tasks, queryClient]);
}
