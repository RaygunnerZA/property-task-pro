import { useAuth } from "@/hooks/useAuth";
import { canAccessDevTools } from "@/lib/dev/devToolsAccess";

/** Client-side gate for Dev Tools UI (never sufficient for admin data access). */
export function useCanAccessDevTools(): boolean {
  const { user } = useAuth();
  return canAccessDevTools(user?.email);
}
