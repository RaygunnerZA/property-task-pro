import { useOrg } from "@/contexts/DataContext";

/**
 * @deprecated Use {@link useOrg} from `@/contexts/DataContext` instead. This alias exists for legacy imports only.
 */
export function useCurrentOrg() {
  return useOrg();
}
