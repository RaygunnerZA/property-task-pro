import { useState } from "react";
import { Check, ChevronDown, Copy, ExternalLink, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useOrgIntakeEmail } from "@/hooks/useOrgIntakeEmail";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface ForwardEmailSectionProps {
  className?: string;
}

export function ForwardEmailSection({ className }: ForwardEmailSectionProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data: address, isLoading, error } = useOrgIntakeEmail();
  const { user } = useAuth();
  const loginEmail = user?.email?.trim().toLowerCase();

  const handleCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const mailtoHref = address
    ? `mailto:${encodeURIComponent(address)}?subject=${encodeURIComponent("Forward to Filla")}`
    : undefined;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn(className)}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-[10px] bg-card/80 px-3 py-2.5 text-left shadow-e1 transition-colors hover:bg-card"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Mail className="h-4 w-4 text-primary" />
            Forward email
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-2">
        <p className="text-xs leading-relaxed text-muted-foreground">
          In Apple Mail, Outlook, or Gmail: open the message → <strong className="font-medium text-foreground">Forward</strong> → paste this address. Works for conversations and threads too — a PDF is not required.
        </p>
        {loginEmail ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Forward from <span className="font-medium text-foreground">{loginEmail}</span> (must match your Filla login). Other senders appear in Issues, not here.
          </p>
        ) : null}
        <div className="flex items-center gap-2 rounded-[10px] bg-muted/40 px-3 py-2">
          <code className="min-w-0 flex-1 truncate text-xs text-foreground">
            {isLoading ? "Loading…" : error ? "Could not load address" : address ?? "Unavailable"}
          </code>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            disabled={!address || isLoading}
            onClick={() => void handleCopy()}
            aria-label="Copy intake email address"
          >
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        {mailtoHref ? (
          <Button type="button" variant="secondary" size="sm" className="w-full" asChild>
            <a href={mailtoHref}>
              <ExternalLink className="h-3.5 w-3.5 mr-2" />
              Open in Mail app
            </a>
          </Button>
        ) : null}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Allow up to a minute after forwarding. Nothing here? Check <strong className="font-medium">Issues → Needs review</strong> if you forwarded from a different address.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
