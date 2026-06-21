import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { STARTER_TEMPLATE_SUMMARY } from "@/lib/starterTemplateDisclaimer";

interface StarterTemplateDisclaimerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (dontShowAgain: boolean) => void | Promise<void>;
  loading?: boolean;
}

export function StarterTemplateDisclaimerDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: StarterTemplateDisclaimerDialogProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (!next) setDontShowAgain(false);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-background shadow-e3 rounded-2xl border-0">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Before you continue</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>{STARTER_TEMPLATE_SUMMARY}</p>
          <p>
            Laws, regulations, standards and inspection requirements vary by country, region,
            property type and use.
          </p>
          <p>
            You are responsible for ensuring that any checklist, task or compliance programme is
            appropriate for your properties and complies with applicable regulations.
          </p>
          <p>
            Filla does not provide legal, regulatory, health and safety or professional compliance
            advice.
          </p>
          <p>We recommend that you review all templates and seek professional advice where required.</p>
        </div>

        <div className="flex items-start gap-2 pt-1">
          <Checkbox
            id="starter-disclaimer-dont-show"
            checked={dontShowAgain}
            onCheckedChange={(checked) => setDontShowAgain(checked === true)}
          />
          <Label
            htmlFor="starter-disclaimer-dont-show"
            className="text-sm font-normal leading-snug cursor-pointer"
          >
            Don&apos;t show this again
          </Label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-[#8EC9CE] text-white hover:brightness-105"
            disabled={loading}
            onClick={() => void onConfirm(dontShowAgain)}
          >
            {loading ? "Saving…" : "I Understand"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
