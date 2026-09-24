/**
 * Email things to Filla — personal address + vCard download.
 * Neomorphic companion to Add to Filla (illustration + short copy + two actions).
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Contact, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useMemberIntakeEmail } from "@/hooks/useMemberIntakeEmail";
import { supabase } from "@/integrations/supabase/client";
import {
  buildFillaIntakeVCard,
  fillaIntakeVCardFilename,
  openVCardForImport,
  pngUrlToBase64,
} from "@/lib/intake/fillaIntakeVCard";
import { cn } from "@/lib/utils";
import emailThingsGif from "@/assets/intake/email-things-to-filla.gif";
import vcardPhotoUrl from "@/assets/intake/fwd-filla-vcard.png";

type Props = {
  className?: string;
  /** Tighter layout for sheet / profile. */
  compact?: boolean;
  /** Hide the instructional GIF (e.g. Profile). */
  hideIllustration?: boolean;
  /** Override headline; pass null to hide (Profile uses the card title). */
  title?: string | null;
  /** Profile keeps the address visible. The workbench rail does not. */
  showAddress?: boolean;
};

export function EmailThingsToFillaPanel({
  className,
  compact = false,
  hideIllustration = false,
  title = "Email things to Filla",
  showAddress = false,
}: Props) {
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const { data: address, isLoading: addressLoading, error } = useMemberIntakeEmail();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const orgMetaQuery = useQuery({
    queryKey: ["member_intake_vcard_meta", orgId],
    queryFn: async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user?.id || !orgId) throw new Error("Not signed in");

      const [orgRes, countRes] = await Promise.all([
        supabase.from("organisations").select("name").eq("id", orgId).maybeSingle(),
        supabase
          .from("organisation_members")
          .select("org_id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);

      if (orgRes.error) throw orgRes.error;
      if (countRes.error) throw countRes.error;

      return {
        orgName: typeof orgRes.data?.name === "string" ? orgRes.data.name : null,
        membershipCount: countRes.count ?? 1,
      };
    },
    enabled: !!orgId && !orgLoading,
    staleTime: 60_000,
  });

  const multiOrg = (orgMetaQuery.data?.membershipCount ?? 1) > 1;
  const orgName = orgMetaQuery.data?.orgName ?? null;
  const busy = addressLoading || orgLoading || orgMetaQuery.isLoading;

  const handleCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success("Address copied");
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadVCard = async () => {
    if (!address) return;
    setDownloading(true);
    try {
      let photoPngBase64: string | null = null;
      try {
        photoPngBase64 = await pngUrlToBase64(vcardPhotoUrl);
      } catch {
        photoPngBase64 = null;
      }
      const vcf = buildFillaIntakeVCard({
        email: address,
        orgName,
        multiOrg,
        photoPngBase64,
      });
      const mode = openVCardForImport(
        fillaIntakeVCardFilename(orgName, multiOrg),
        vcf
      );
      toast.success(
        mode === "opened"
          ? "Opening Contacts — add Fwd → Filla when prompted"
          : "Contact file ready — open it to add Filla to Contacts"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create contact file");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "grid items-center gap-3",
          hideIllustration ? "grid-cols-1" : "grid-cols-2"
        )}
      >
        {!hideIllustration ? (
          <div className="min-w-0 overflow-hidden rounded-[10px] bg-muted/20 shadow-engraved">
            <img
              src={emailThingsGif}
              alt=""
              className={cn(
                "w-full object-contain object-center",
                compact ? "h-[120px]" : "h-[160px]"
              )}
              draggable={false}
            />
          </div>
        ) : null}

        <div className="min-w-0 space-y-1.5">
          {title ? (
            <p className={cn("font-semibold text-foreground", compact ? "text-xs" : "text-sm")}>
              {title}
            </p>
          ) : null}
          <p
            className={cn(
              "text-muted-foreground leading-snug",
              compact ? "text-2xs" : "text-xs"
            )}
          >
            Add Filla to your contacts, then forward or CC documents, quotes and useful email
            threads. Filla will suggest where they belong and wait for your confirmation.
          </p>
        </div>
      </div>

      {error ? (
        <p className="text-xs text-destructive">Could not load your Filla address.</p>
      ) : null}

      {showAddress && !error ? (
        <div className="flex items-center gap-2 rounded-[10px] bg-muted/40 px-3 py-2 shadow-engraved">
          <code className="min-w-0 flex-1 truncate text-xs text-foreground">
            {busy ? "Loading…" : address ?? "Unavailable"}
          </code>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            disabled={!address || busy}
            onClick={() => void handleCopy()}
            aria-label="Copy address"
          >
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      ) : null}

      <div className="flex flex-nowrap gap-2">
        <Button
          type="button"
          size="sm"
          className="shadow-primary-btn border-0 h-8 min-w-0 flex-1 px-2 text-[11px]"
          disabled={!address || busy || downloading}
          onClick={() => void handleDownloadVCard()}
        >
          {downloading ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 shrink-0 animate-spin" />
          ) : (
            <Contact className="mr-1 h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">Add to Contacts</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-0 btn-neomorphic h-8 min-w-0 flex-1 px-2 text-[11px]"
          disabled={!address || busy}
          onClick={() => void handleCopy()}
        >
          {copied ? (
            <Check className="mr-1 h-3.5 w-3.5 shrink-0 text-primary" />
          ) : (
            <Copy className="mr-1 h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">Copy Address</span>
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        This address is personal to your membership. Do not publish or share it.
      </p>
    </div>
  );
}
