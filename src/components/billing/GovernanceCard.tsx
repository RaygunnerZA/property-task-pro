import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Shield,
  FileDown,
  KeyRound,
  Clock,
  Loader2,
  Check,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrgEntitlements } from "@/hooks/useOrgEntitlements";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useSupabase } from "@/integrations/supabase/useSupabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type RetentionPolicy = "standard" | "extended" | "custom";

function CapabilityRow({
  label,
  enabled,
  note,
}: {
  label: string;
  enabled: boolean;
  note?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <div className="min-w-0">
        <p className="font-medium text-foreground">{label}</p>
        {note ? <p className="text-xs text-muted-foreground mt-0.5">{note}</p> : null}
      </div>
      <span
        className={cn(
          "inline-flex items-center gap-1 shrink-0 text-xs font-mono uppercase tracking-wide",
          enabled ? "text-primary" : "text-muted-foreground"
        )}
      >
        {enabled ? <Check className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
        {enabled ? "On" : "Off"}
      </span>
    </div>
  );
}

export function GovernanceCard() {
  const supabase = useSupabase();
  const { orgId } = useActiveOrg();
  const { entitlements, has, refresh } = useOrgEntitlements();
  const [busy, setBusy] = useState(false);
  const [keyName, setKeyName] = useState("Integration");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [policy, setPolicy] = useState<RetentionPolicy>("standard");
  const [retentionDays, setRetentionDays] = useState(365);
  const [legalHold, setLegalHold] = useState(false);

  const governanceOn =
    has("advanced_audit_export_enabled") ||
    has("configurable_retention_enabled") ||
    has("api_enabled") ||
    has("approval_workflows_enabled");

  const { data: retention, refetch: refetchRetention } = useQuery({
    queryKey: ["org-retention", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from("org_retention_settings" as never)
        .select("*")
        .eq("org_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return data as {
        policy: RetentionPolicy;
        retention_days: number;
        legal_hold: boolean;
      } | null;
    },
    enabled: !!orgId && has("configurable_retention_enabled"),
  });

  const { data: apiKeys = [], refetch: refetchKeys } = useQuery({
    queryKey: ["org-api-keys", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from("org_api_keys" as never)
        .select("id, name, key_prefix, created_at, revoked_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        name: string;
        key_prefix: string;
        created_at: string;
        revoked_at: string | null;
      }>;
    },
    enabled: !!orgId && has("api_enabled"),
  });

  useEffect(() => {
    if (!retention) return;
    setPolicy(retention.policy);
    setRetentionDays(retention.retention_days);
    setLegalHold(retention.legal_hold);
  }, [retention]);

  async function handleExportAudit() {
    if (!orgId) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("export_org_audit_logs" as never, {
        p_org_id: orgId,
        p_days: 90,
      } as never);
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      const blob = new Blob([JSON.stringify(rows, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `filla-audit-${orgId.slice(0, 8)}-90d.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} audit events`);
    } catch (e) {
      toast.error("Could not export audit log", {
        description: e instanceof Error ? e.message : "Not entitled or failed",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveRetention() {
    if (!orgId) return;
    const days =
      policy === "standard" ? 365 : policy === "extended" ? 1095 : retentionDays;
    setRetentionDays(days);
    setBusy(true);
    try {
      const { error } = await supabase.rpc("upsert_org_retention_settings" as never, {
        p_org_id: orgId,
        p_policy: policy,
        p_retention_days: days,
        p_legal_hold: legalHold,
      } as never);
      if (error) throw error;
      toast.success("Retention settings saved");
      void refetchRetention();
      refresh();
    } catch (e) {
      toast.error("Could not save retention", {
        description: e instanceof Error ? e.message : "Not entitled or failed",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateKey() {
    if (!orgId) return;
    setBusy(true);
    setRevealedKey(null);
    try {
      const { data, error } = await supabase.rpc("create_org_api_key" as never, {
        p_org_id: orgId,
        p_name: keyName,
      } as never);
      if (error) throw error;
      const payload = data as { api_key?: string } | null;
      if (payload?.api_key) setRevealedKey(payload.api_key);
      toast.success("API key created — copy it now; it won’t be shown again");
      void refetchKeys();
    } catch (e) {
      toast.error("Could not create API key", {
        description: e instanceof Error ? e.message : "Not entitled or failed",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleRevokeKey(id: string) {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("revoke_org_api_key" as never, {
        p_key_id: id,
      } as never);
      if (error) throw error;
      toast.success("API key revoked");
      void refetchKeys();
    } catch (e) {
      toast.error("Could not revoke key", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="shadow-e1">
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle>Governance</CardTitle>
          </div>
          {!governanceOn && (
            <Button type="button" size="sm" variant="secondary" asChild>
              <Link to="/settings/billing">Explore Business</Link>
            </Button>
          )}
        </div>
        <CardDescription>
          Business controls: audit export, retention, API keys, and governance flags.
          Approvals and SSO IdP wiring ship after this foundation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3 rounded-[10px] bg-muted/40 px-3 py-3">
          <CapabilityRow
            label="Approval workflows"
            enabled={entitlements.approval_workflows_enabled}
            note="Flag reserved — workflow engine not shipped yet"
          />
          <CapabilityRow
            label="Advanced audit export"
            enabled={entitlements.advanced_audit_export_enabled}
          />
          <CapabilityRow
            label="Configurable retention"
            enabled={entitlements.configurable_retention_enabled}
          />
          <CapabilityRow
            label="Teams / regions"
            enabled={entitlements.teams_regions_enabled}
            note="Uses existing task teams; regional hierarchy later"
          />
          <CapabilityRow
            label="API access"
            enabled={entitlements.api_enabled}
          />
          <CapabilityRow
            label="SSO / provisioning"
            enabled={entitlements.sso_enabled}
            note="Entitlement only — IdP not connected yet"
          />
        </div>

        {has("advanced_audit_export_enabled") && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileDown className="h-4 w-4 text-primary" />
              Org audit export
            </div>
            <p className="text-xs text-muted-foreground">
              Download the last 90 days of organisation audit events (JSON).
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => void handleExportAudit()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Export audit log
              </Button>
              <Button type="button" size="sm" variant="outline" asChild>
                <Link to="/compliance/audit">Compliance audit packs</Link>
              </Button>
            </div>
          </div>
        )}

        {has("configurable_retention_enabled") && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4 text-primary" />
              Retention policy
            </div>
            <p className="text-xs text-muted-foreground">
              Stored for governance and future lifecycle jobs. Does not hard-delete data today.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Policy</Label>
                <Select
                  value={policy}
                  onValueChange={(v) => setPolicy(v as RetentionPolicy)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard (365 days)</SelectItem>
                    <SelectItem value="extended">Extended (1095 days)</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="retention-days">Retention days</Label>
                <Input
                  id="retention-days"
                  type="number"
                  min={30}
                  max={3650}
                  value={retentionDays}
                  disabled={policy !== "custom"}
                  onChange={(e) => setRetentionDays(Number(e.target.value) || 365)}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="rounded border-border"
                checked={legalHold}
                onChange={(e) => setLegalHold(e.target.checked)}
              />
              Legal hold (block automated purge when jobs ship)
            </label>
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void handleSaveRetention()}
            >
              Save retention
            </Button>
          </div>
        )}

        {has("api_enabled") && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="h-4 w-4 text-primary" />
              API keys
            </div>
            <p className="text-xs text-muted-foreground">
              Mint and revoke keys for future integrations. Public API surface is not live yet.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1.5 min-w-[160px]">
                <Label htmlFor="api-key-name">Name</Label>
                <Input
                  id="api-key-name"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={busy || keyName.trim().length < 2}
                onClick={() => void handleCreateKey()}
              >
                Create key
              </Button>
            </div>
            {revealedKey && (
              <div className="rounded-[10px] bg-background px-3 py-2 shadow-inset font-mono text-xs break-all">
                {revealedKey}
              </div>
            )}
            <ul className="space-y-2">
              {apiKeys
                .filter((k) => !k.revoked_at)
                .map((k) => (
                  <li
                    key={k.id}
                    className="flex items-center justify-between gap-2 text-sm rounded-[10px] bg-card/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{k.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {k.key_prefix}…
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void handleRevokeKey(k.id)}
                    >
                      Revoke
                    </Button>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
