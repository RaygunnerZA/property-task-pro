// Thin wrapper around DataContext for user ID
// Maintains backward compatibility with existing imports
import { useDataContext } from "@/contexts/DataContext";

export function useUserId() {
  const { userId } = useDataContext();
  return userId;
}
