import { useSession } from "../hooks/useSession";

export function useOrganisationId() {
  const { session } = useSession();

  const orgId =
    session?.user?.app_metadata?.org_id ||
    session?.user?.user_metadata?.org_id ||
    null;

  return orgId as string | null;
}
