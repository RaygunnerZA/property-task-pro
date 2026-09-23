import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, Copy, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useMemberIntakeEmail } from "@/hooks/useMemberIntakeEmail";
import { cn } from "@/lib/utils";

interface ForwardEmailSectionProps {
  className?: string;
}

export function ForwardEmailSection({ className }: ForwardEmailSectionProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data: address, isLoading, error } = useMemberIntakeEmail();

  const handleCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn(className)}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-[10px] bg-card/80 px-3 py-2.5 text-left shadow-e1 transition-colors hover:bg-card"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Mail className="h-4 w-4 text-primary" />
            Your Filla address
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-2">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Send or CC this address. You confirm the suggestion on Home → Needs review.
        </p>
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
            aria-label="Copy Filla address"
          >
            {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <Link to="/settings/profile" className="inline-block text-xs font-medium text-foreground hover:underline">
          How this address works
        </Link>
      </CollapsibleContent>
    </Collapsible>
  );
}
