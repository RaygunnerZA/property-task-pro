import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterDimensionOption = { id: string; label: string };
export type FilterDimensionGroup = {
  id: string;
  label: string;
  options: FilterDimensionOption[];
};

type FilterDimensionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  groups: FilterDimensionGroup[];
  selectedIds: Set<string>;
  onToggle: (id: string, selected: boolean) => void;
};

/**
 * Bottom sheet for filter dimensions. Shared by Tasks, Calendar, and Assets.
 * Uses its own dialog so the app sheet's phone-centering rules do not push it off screen.
 */
export function FilterDimensionSheet({
  open,
  onOpenChange,
  title = "Filters",
  groups,
  selectedIds,
  onToggle,
}: FilterDimensionSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-scrim fixed inset-0 z-[110]" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-[110] max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-background p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-lg outline-none"
        >
          <div className="mb-4 flex items-center justify-between gap-3 pr-8">
            <Dialog.Title className="text-lg font-semibold text-foreground">{title}</Dialog.Title>
          </div>
          <Dialog.Close
            className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Dialog.Close>
          <div className="space-y-5">
            {groups.map((group) => (
              <fieldset key={group.id} className="min-w-0 space-y-2">
                <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </legend>
                {group.options.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None available</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {group.options.map((option) => {
                      const selected = selectedIds.has(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => onToggle(option.id, !selected)}
                          className={cn(
                            "min-h-11 rounded-full px-3 text-sm shadow-sm",
                            selected
                              ? "bg-primary/20 font-medium text-foreground"
                              : "bg-card text-muted-foreground"
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </fieldset>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
