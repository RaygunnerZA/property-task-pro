import { useState } from "react";
import { Calendar, Cloud, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConnectedAccounts, startOAuthConnect } from "@/hooks/useConnectedAccounts";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface ConnectedAccountsPanelProps {
  className?: string;
}

export function ConnectedAccountsPanel({ className }: ConnectedAccountsPanelProps) {
  const { orgId } = useActiveOrg();
  const { toast } = useToast();
  const { data: accounts = [], isLoading, refetch } = useConnectedAccounts();
  const [connecting, setConnecting] = useState<"google" | "microsoft" | null>(null);

  const googleConnected = accounts.some((a) => a.provider === "google" && a.status === "active");
  const microsoftConnected = accounts.some((a) => a.provider === "microsoft" && a.status === "active");

  const handleConnect = async (provider: "google" | "microsoft") => {
    if (!orgId) return;
    setConnecting(provider);
    try {
      const redirectUri = `${window.location.origin}/settings/integrations`;
      const url = await startOAuthConnect(provider, orgId, redirectUri);
      window.location.href = url;
    } catch (error) {
      toast({
        title: "Connection unavailable",
        description: error instanceof Error ? error.message : "OAuth is not configured yet.",
      });
    } finally {
      setConnecting(null);
      void refetch();
    }
  };

  return (
    <section className={cn("space-y-4", className)}>
      <div>
        <h2 className="text-base font-semibold text-foreground">Connected accounts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Link Google or Microsoft to import calendar events and pick files from cloud storage.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading connections…
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] bg-card/80 px-4 py-3 shadow-e1">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Google</p>
                <p className="text-xs text-muted-foreground">Calendar & Drive</p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant={googleConnected ? "secondary" : "default"}
              disabled={connecting !== null || googleConnected}
              onClick={() => void handleConnect("google")}
            >
              {connecting === "google" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : googleConnected ? (
                "Connected"
              ) : (
                "Connect"
              )}
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] bg-card/80 px-4 py-3 shadow-e1">
            <div className="flex items-center gap-3">
              <Cloud className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Microsoft</p>
                <p className="text-xs text-muted-foreground">Outlook Calendar & OneDrive</p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant={microsoftConnected ? "secondary" : "default"}
              disabled={connecting !== null || microsoftConnected}
              onClick={() => void handleConnect("microsoft")}
            >
              {connecting === "microsoft" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : microsoftConnected ? (
                "Connected"
              ) : (
                "Connect"
              )}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

export default function SettingsIntegrations() {
  return (
    <div className="space-y-6">
      <ConnectedAccountsPanel />
    </div>
  );
}
