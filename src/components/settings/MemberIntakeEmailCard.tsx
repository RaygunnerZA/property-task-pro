import { useState } from "react";
import { Check, Copy, KeyRound, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMemberIntakeEmail, useRotateMemberIntakeEmail } from "@/hooks/useMemberIntakeEmail";

export function MemberIntakeEmailCard() {
  const { data: address, isLoading, error } = useMemberIntakeEmail();
  const rotate = useRotateMemberIntakeEmail();
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleRotate = async () => {
    try {
      await rotate.mutateAsync();
      setConfirmOpen(false);
      toast.success("New address ready. The previous address no longer works.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not replace the address");
    }
  };

  return (
    <Card className="shadow-e1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          Your Filla address
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Send or CC this address when an email, quote, certificate or note belongs in Filla.
          Filla will suggest a task, reminder, record or reusable Knowledge item. Nothing is
          filed until you confirm it in Needs review.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Mail that is not from your Filla login still appears in Needs review, labelled External
          sender—not verified as you.
        </p>
        <div className="flex items-center gap-2 rounded-[10px] bg-muted/40 px-3 py-2 shadow-engraved">
          <code className="min-w-0 flex-1 truncate text-xs text-foreground">
            {isLoading ? "Loading…" : error ? "Could not load address" : address}
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
        <div className="flex flex-wrap gap-2">
          {address ? (
            <Button type="button" variant="secondary" size="sm" asChild>
              <a href={`mailto:${encodeURIComponent(address)}`}>Open in Mail</a>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setConfirmOpen(true)}
            disabled={!address || rotate.isPending}
          >
            <KeyRound className="mr-2 h-3.5 w-3.5" />
            New address
          </Button>
        </div>
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace your Filla address?</DialogTitle>
            <DialogDescription>
              The current address stops working immediately. Update any forwards or CC rules that
              use it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleRotate()} disabled={rotate.isPending}>
              {rotate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Replace address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
