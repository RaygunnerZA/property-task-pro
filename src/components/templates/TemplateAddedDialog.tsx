import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface TemplateAddedDialogProps {
  open: boolean;
  templateName: string | null;
  onOpenChange: (open: boolean) => void;
  onOpenTemplate: () => void;
}

export function TemplateAddedDialog({
  open,
  templateName,
  onOpenChange,
  onOpenTemplate,
}: TemplateAddedDialogProps) {
  if (!templateName) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm bg-background shadow-e3 rounded-2xl border-0">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold pr-4">{templateName} added to your library</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Review this template and adapt it to your property, jurisdiction and operating requirements.
        </p>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            className="bg-[#8EC9CE] text-white hover:brightness-105"
            onClick={() => {
              onOpenTemplate();
              onOpenChange(false);
            }}
          >
            Open Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
