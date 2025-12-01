// Thin wrapper around DataContext for organisation state
import { useOrg } from "@/contexts/DataContext";

export function useCurrentOrg() {
  return useOrg();
}
