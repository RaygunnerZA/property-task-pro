// Thin wrapper around DataContext for session state
// Maintains backward compatibility with existing imports
import { useDataContext } from "@/contexts/DataContext";

export function useSession() {
  const { session, loading } = useDataContext();
  return { session, loading };
}
