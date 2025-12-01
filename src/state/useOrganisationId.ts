// Thin wrapper around DataContext for organisation ID
// Maintains backward compatibility with existing imports
import { useDataContext } from "@/contexts/DataContext";

export function useOrganisationId() {
  const { orgId } = useDataContext();
  return orgId;
}
