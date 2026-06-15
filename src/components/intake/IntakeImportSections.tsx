import { useState } from "react";
import { CalendarDays, ChevronDown, Cloud, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useConnectedAccounts } from "@/hooks/useConnectedAccounts";
import { supabase } from "@/integrations/supabase/client";
import { useIntakeItemsInvalidator } from "@/hooks/useIntakeItems";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CalendarImportSectionProps {
  className?: string;
}

export function CalendarImportSection({ className }: CalendarImportSectionProps) {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const { orgId } = useActiveOrg();
  const { data: accounts = [] } = useConnectedAccounts();
  const invalidate = useIntakeItemsInvalidator();
  const { toast } = useToast();

  const hasConnection = accounts.some((a) => a.status === "active");

  const handleImport = async () => {
    if (!orgId || !hasConnection) return;
    const provider = accounts.find((a) => a.status === "active")?.provider;
    if (provider !== "google" && provider !== "microsoft") return;

    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("calendar-import", {
        body: {
          org_id: orgId,
          provider,
          time_min: new Date().toISOString(),
          time_max: new Date(Date.now() + 30 * 86400000).toISOString(),
          import: true,
        },
      });
      if (error) throw error;
      const payload = data as { message?: string; error?: string };
      if (payload.error === "not_connected") {
        toast({
          title: "Connect an account first",
          description: "Link Google or Microsoft in Settings → Integrations.",
        });
        return;
      }
      void invalidate();
      toast({
        title: "Calendar import",
        description: payload.message ?? "Import shell ready — full sync follows OAuth callback.",
      });
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn(className)}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-[10px] bg-card/80 px-3 py-2.5 text-left shadow-e1 transition-colors hover:bg-card"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <CalendarDays className="h-4 w-4 text-primary" />
            Import calendar
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pt-2">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Pull upcoming inspection or maintenance events from a connected calendar into Add to Filla review.
        </p>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="w-full"
          disabled={!hasConnection || importing}
          onClick={() => void handleImport()}
        >
          {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {hasConnection ? "Import next 30 days" : "Connect account in Settings"}
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface CloudPickerSectionProps {
  className?: string;
}

export function CloudPickerSection({ className }: CloudPickerSectionProps) {
  const [open, setOpen] = useState(false);
  const { data: accounts = [] } = useConnectedAccounts();
  const { toast } = useToast();
  const hasConnection = accounts.some((a) => a.status === "active");

  const handlePick = (provider: "google" | "microsoft") => {
    toast({
      title: "Cloud picker",
      description: `${provider === "google" ? "Google Drive" : "OneDrive"} picker follows OAuth token storage (Phase 4).`,
    });
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn(className)}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-[10px] bg-card/80 px-3 py-2.5 text-left shadow-e1 transition-colors hover:bg-card"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Cloud className="h-4 w-4 text-primary" />
            Cloud files
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 pt-2">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Pick a file from Google Drive or OneDrive — it will go through the same review flow as uploads.
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="flex-1"
            disabled={!hasConnection}
            onClick={() => handlePick("google")}
          >
            Google Drive
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="flex-1"
            disabled={!hasConnection}
            onClick={() => handlePick("microsoft")}
          >
            OneDrive
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
