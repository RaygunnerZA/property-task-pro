import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@/hooks/property/usePropertyDocuments";
import { cn } from "@/lib/utils";

type ChangeCategoryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentCount: number;
  currentCategory?: string | null;
  onSave: (category: DocumentCategory | null) => Promise<void> | void;
};

export function ChangeCategoryDialog({
  open,
  onOpenChange,
  documentCount,
  currentCategory = null,
  onSave,
}: ChangeCategoryDialogProps) {
  const [selected, setSelected] = useState<string | null>(currentCategory);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setSelected(currentCategory);
  }, [open, currentCategory]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(selected as DocumentCategory | null);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm sm:rounded-card">
        <DialogHeader>
          <DialogTitle className="text-base">Change category</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {documentCount === 1
              ? "Set the document category."
              : `Apply to ${documentCount} selected documents.`}
          </p>
        </DialogHeader>
        <ul className="max-h-[50vh] space-y-0.5 overflow-y-auto">
          <li>
            <button
              type="button"
              className={cn(
                "flex w-full rounded-md px-2.5 py-2 text-left text-sm",
                selected === null ? "bg-primary/15 text-foreground" : "hover:bg-muted/40"
              )}
              onClick={() => setSelected(null)}
            >
              Uncategorised
            </button>
          </li>
          {DOCUMENT_CATEGORIES.map((cat) => (
            <li key={cat}>
              <button
                type="button"
                className={cn(
                  "flex w-full rounded-md px-2.5 py-2 text-left text-sm",
                  selected === cat ? "bg-primary/15 text-foreground" : "hover:bg-muted/40"
                )}
                onClick={() => setSelected(cat)}
              >
                {cat === "Misc" ? "Miscellaneous" : cat}
              </button>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
