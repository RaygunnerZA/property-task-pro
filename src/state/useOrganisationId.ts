import { useAuth } from "../hooks/useAuth";

export function useOrganisationId(): string | undefined {
  const { session } = useAuth();
  return session?.user?.user_metadata?.org_id;
}
