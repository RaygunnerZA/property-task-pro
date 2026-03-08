import { useState, useEffect, useCallback } from "react";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubtaskList, SubtaskData } from "@/components/tasks/subtasks";
import type { ChecklistTemplateCategory } from "@/hooks/useChecklistTemplates";

export const CATEGORY_OPTIONS: Array<{ value: ChecklistTemplateCategory; label: string }> = [
  { value: "compliance", label: "Compliance" },
  { value: "maintenance", label: "Maintenance" },
  { value: "security", label: "Security" },
  { value: "operations", label: "Operations" },
];

export interface TemplateDialogValue {
  name: string;
  category: ChecklistTemplateCategory;
  items: SubtaskData[];
}

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialValue?: Partial<TemplateDialogValue>;
  onSubmit: (value: TemplateDialogValue) => Promise<void>;
  loading?: boolean;
}

function makeItem(title = ""): SubtaskData {
  return { id: crypto.randomUUID(), title, is_yes_no: false, requires_signature: false };
}

export function TemplateDialog({
  open,
  onOpenChange,
  mode,
  initialValue,
  onSubmit,
  loading = false,
}: TemplateDialogProps) {
  const [name, setName] = useState(initialValue?.name ?? "");
  const [category, setCategory] = useState<ChecklistTemplateCategory>(
    initialValue?.category ?? "operations"
  );
  const [items, setItems] = useState<SubtaskData[]>(
    initialValue?.items?.length ? initialValue.items : [makeItem()]
  );

  // Re-seed when dialog opens with new initial values
  useEffect(() => {
    if (open) {
      setName(initialValue?.name ?? "");
      setCategory(initialValue?.category ?? "operations");
      setItems(initialValue?.items?.length ? initialValue.items : [makeItem()]);
    }
  }, [open, initialValue?.name, initialValue?.category]);

  const handleAddItem = useCallback(() => {
    setItems((prev) => [...prev, makeItem()]);
  }, []);

  const handleReorder = useCallback(() => {
    // order is already updated via onSubtasksChange
  }, []);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const nonEmptyItems = items.filter((i) => i.title.trim().length > 0);
    await onSubmit({ name: trimmedName, category, items: nonEmptyItems });
  };

  const isValid = name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-background shadow-e3 rounded-2xl border-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-lg font-semibold">
            {mode === "create" ? "New Checklist Template" : "Edit Template"}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-2 space-y-5">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Template Name
            </Label>
            <Input
              placeholder="e.g. End-of-Tenancy Inspection"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="shadow-engraved border-0 bg-background focus-visible:ring-0 rounded-xl h-10"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Category
            </Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as ChecklistTemplateCategory)}
            >
              <SelectTrigger className="shadow-engraved border-0 bg-background focus:ring-0 rounded-xl h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-0 shadow-e3 rounded-xl">
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Checklist Items */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Checklist Items
            </Label>
            <div className="shadow-engraved rounded-xl px-3 py-3 bg-background min-h-[80px]">
              <SubtaskList
                subtasks={items}
                isCreator
                onSubtasksChange={setItems}
                onReorder={handleReorder}
              />
              <button
                type="button"
                onClick={handleAddItem}
                className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors pl-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Add item
              </button>
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 flex gap-2 justify-end border-t border-border/40">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className="rounded-xl bg-[#8EC9CE] hover:bg-[#7ab8bd] text-white border-0 shadow-primary-btn"
          >
            {loading ? "Saving…" : mode === "create" ? "Create Template" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
