import { useSession } from "./useSession";

export function useUserId() {
  const { session } = useSession();
  return session?.user?.id ?? null;
}
