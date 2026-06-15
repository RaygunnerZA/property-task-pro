import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "./useActiveOrg";

export type ConnectedAccountProvider = "google" | "microsoft" | "apple";
export type ConnectedAccountStatus = "active" | "expired" | "revoked";

export interface ConnectedAccount {
  id: string;
  org_id: string;
  user_id: string;
  provider: ConnectedAccountProvider;
  provider_account_id: string;
  scopes: string[];
  status: ConnectedAccountStatus;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useConnectedAccounts() {
  const { orgId, isLoading: orgLoading } = useActiveOrg();

  return useQuery({
    queryKey: ["connected_accounts", orgId],
    queryFn: async (): Promise<ConnectedAccount[]> => {
      const { data, error } = await supabase
        .from("connected_accounts")
        .select("id, org_id, user_id, provider, provider_account_id, scopes, status, token_expires_at, created_at, updated_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ConnectedAccount[];
    },
    enabled: !!orgId && !orgLoading,
  });
}

export async function startOAuthConnect(
  provider: "google" | "microsoft",
  orgId: string,
  redirectUri: string
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("oauth-connect-start", {
    body: { provider, org_id: orgId, redirect_uri: redirectUri },
  });
  if (error) throw error;
  const payload = data as { url?: string; error?: string; message?: string };
  if (payload.error) {
    throw new Error(payload.message ?? payload.error);
  }
  if (!payload.url) throw new Error("OAuth URL not returned");
  return payload.url;
}
