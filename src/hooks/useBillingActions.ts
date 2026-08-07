import { useState } from "react";
import { useSupabase } from "@/integrations/supabase/useSupabase";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { edgeFunctionErrorMessage } from "@/lib/edgeFunctionErrors";
import type { PlanTierId } from "@/lib/billing/planCatalog";
import { trackAddonCheckoutStarted } from "@/lib/billing/quotaTelemetry";

type CheckoutMode =
  | "subscription"
  | "seat_addon"
  | "storage_addon"
  | "ai_addon"
  | "messaging_addon";

export function useBillingActions() {
  const supabase = useSupabase();
  const { orgId } = useActiveOrg();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(opts: {
    tierId?: PlanTierId;
    mode?: CheckoutMode;
    seatQuantity?: number;
    storagePackQuantity?: number;
    aiPackQuantity?: number;
    messagingPackQuantity?: number;
  }): Promise<{ url?: string; usePortal?: boolean; error?: string }> {
    if (!orgId) return { error: "No active organisation" };
    setBusy(true);
    setError(null);
    const mode = opts.mode ?? "subscription";
    trackAddonCheckoutStarted(orgId, mode);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "create-checkout-session",
        {
          body: {
            org_id: orgId,
            tier_id: opts.tierId,
            mode,
            seat_quantity: opts.seatQuantity ?? 1,
            storage_pack_quantity: opts.storagePackQuantity ?? 1,
            ai_pack_quantity: opts.aiPackQuantity ?? 1,
            messaging_pack_quantity: opts.messagingPackQuantity ?? 1,
          },
        }
      );

      if (
        data?.use_portal ||
        data?.error === "existing_subscription"
      ) {
        return { usePortal: true };
      }

      if (invokeError) {
        const message = edgeFunctionErrorMessage(invokeError, data, "Checkout failed");
        if (message.includes("already have a subscription")) {
          return { usePortal: true };
        }
        setError(message);
        return { error: message };
      }

      if (data?.error) {
        setError(String(data.error));
        return { error: String(data.error) };
      }

      if (data?.url) {
        window.location.assign(data.url as string);
        return { url: data.url as string };
      }

      return { error: "No checkout URL returned" };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Checkout failed";
      setError(message);
      return { error: message };
    } finally {
      setBusy(false);
    }
  }

  async function openBillingPortal(): Promise<{ url?: string; error?: string }> {
    if (!orgId) return { error: "No active organisation" };
    setBusy(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "create-billing-portal",
        { body: { org_id: orgId } }
      );
      if (invokeError) {
        const message = edgeFunctionErrorMessage(invokeError, data, "Portal failed");
        setError(message);
        return { error: message };
      }
      if (data?.error) {
        setError(String(data.error));
        return { error: String(data.error) };
      }
      if (data?.url) {
        window.location.assign(data.url as string);
        return { url: data.url as string };
      }
      return { error: "No portal URL returned" };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Portal failed";
      setError(message);
      return { error: message };
    } finally {
      setBusy(false);
    }
  }

  async function archiveExcept(keepIds: string[]): Promise<{ archived?: number; error?: string }> {
    if (!orgId) return { error: "No active organisation" };
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc(
        "select_active_properties_for_limit",
        {
          p_org_id: orgId,
          p_keep_property_ids: keepIds,
        }
      );
      if (rpcError) {
        setError(rpcError.message);
        return { error: rpcError.message };
      }
      return { archived: typeof data === "number" ? data : 0 };
    } finally {
      setBusy(false);
    }
  }

  return {
    busy,
    error,
    startCheckout,
    openBillingPortal,
    archiveExcept,
    clearError: () => setError(null),
  };
}
