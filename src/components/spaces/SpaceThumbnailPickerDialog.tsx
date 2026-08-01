import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import {
  listSpaceMiniCardIllustrations,
  type SpaceMiniCardOption,
} from "@/lib/spaceTypeIllustrations";
import { cn } from "@/lib/utils";

type SpaceThumbnailPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentSrc?: string | null;
  spaceName?: string | null;
  onSelect: (src: string) => void | Promise<void>;
  busy?: boolean;
};

export function SpaceThumbnailPickerDialog({
  open,
  onOpenChange,
  currentSrc,
  spaceName,
  onSelect,
  busy = false,
}: SpaceThumbnailPickerDialogProps) {
  const options = useMemo(() => listSpaceMiniCardIllustrations(), []);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<SpaceMiniCardOption | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.slug.toLowerCase().includes(q)
    );
  }, [options, query]);

  const selectedSrc = pending?.src ?? currentSrc ?? null;

  const handleSave = async () => {
    if (!pending) {
      onOpenChange(false);
      return;
    }
    await onSelect(pending.src);
    setPending(null);
    setQuery("");
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setPending(null);
          setQuery("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg gap-3 p-4" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold tracking-tight">
            Replace thumbnail
            {spaceName ? (
              <span className="font-normal text-muted-foreground"> — {spaceName}</span>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <div className="relative flex items-center gap-2 rounded-[10px] bg-background/80 px-3 py-2 shadow-[inset_1px_2px_4px_rgba(0,0,0,0.08),inset_-1px_-1px_2px_rgba(255,255,255,0.5)]">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search space images"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
            aria-label="Search space images"
          />
        </div>

        <div className="max-h-[340px] overflow-y-auto overscroll-contain rounded-[10px] bg-muted/20 p-2 shadow-e1">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {filtered.map((opt) => {
              const isSelected = selectedSrc === opt.src;
              return (
                <button
                  key={opt.slug}
                  type="button"
                  onClick={() => setPending(opt)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-card bg-card p-2 text-center shadow-e1 transition-shadow",
                    isSelected
                      ? "ring-2 ring-primary shadow-md"
                      : "hover:shadow-md"
                  )}
                  aria-pressed={isSelected}
                  aria-label={opt.label}
                >
                  <img
                    src={opt.src}
                    alt=""
                    className="h-16 w-16 object-contain"
                    loading="lazy"
                  />
                  <span className="line-clamp-2 text-[10px] font-medium leading-tight text-muted-foreground">
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No images match your search.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <NeomorphicButton
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </NeomorphicButton>
          <NeomorphicButton
            variant="primary"
            onClick={() => void handleSave()}
            disabled={busy || !pending}
          >
            {busy ? "Saving…" : "Use image"}
          </NeomorphicButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
