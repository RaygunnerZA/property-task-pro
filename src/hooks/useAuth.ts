// Thin wrapper around DataContext for auth state
// Maintains backward compatibility with existing imports
import { useAuth as useAuthFromContext } from "@/contexts/DataContext";

export function useAuth() {
  return useAuthFromContext();
}
