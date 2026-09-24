import { useState } from "react";
import { KeyRound, Loader2, Mail } from "lucide-react";
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
import { EmailThingsToFillaPanel } from "@/components/intake/EmailThingsToFillaPanel";
import { useMemberIntakeEmail, useRotateMemberIntakeEmail } from "@/hooks/useMemberIntakeEmail";

export function MemberIntakeEmailCard() {
  const { data: address } = useMemberIntakeEmail();
  const rotate = useRotateMemberIntakeEmail();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleRotate = async () => {
    try {
      await rotate.mutateAsync();
      setConfirmOpen(false);
      toast.success("New address ready. Download a fresh contact file — the previous address no longer works.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not replace the address");
    }
  };

  return (
    <Card className="shadow-e1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          Fwd → Filla
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <EmailThingsToFillaPanel
          hideIllustration
          showAddress
          title={null}
          className="shadow-none bg-transparent px-0 py-0"
        />

        <p className="text-sm leading-relaxed text-muted-foreground">
          Mail that is not from your Filla login still appears in Needs review, labelled External
          sender—not verified as you.
        </p>

        <div className="flex flex-wrap gap-2">
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
              The current address stops working immediately. Download a new contact file and update
              any forwards or CC rules that use the old address.
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
