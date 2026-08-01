import { useEffect, useMemo, useState } from "react";
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
  /** Dialog heading (default: Replace thumbnail). */
  title?: string;
};

/** Dock-style scale: hovered grows; nearer cells ease down to make room. */
function thumbnailHoverScale(
  index: number,
  hoveredIndex: number | null,
  cols: number
): number {
  if (hoveredIndex == null) return 1;
  if (index === hoveredIndex) return 1.2;

  const row = Math.floor(index / cols);
  const col = index % cols;
  const hRow = Math.floor(hoveredIndex / cols);
  const hCol = hoveredIndex % cols;
  const dist = Math.max(Math.abs(row - hRow), Math.abs(col - hCol));

  if (dist === 1) return 0.82;
  if (dist === 2) return 0.9;
  return 0.94;
}

export function SpaceThumbnailPickerDialog({
  open,
  onOpenChange,
  currentSrc,
  spaceName,
  onSelect,
  busy = false,
  title = "Replace thumbnail",
}: SpaceThumbnailPickerDialogProps) {
  const options = useMemo(() => listSpaceMiniCardIllustrations(), []);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<SpaceMiniCardOption | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [cols, setCols] = useState(4);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => setCols(mq.matches ? 4 : 3);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open) setHoveredIndex(null);
  }, [open]);

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
          setHoveredIndex(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg gap-3 p-4" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-base font-semibold tracking-tight">
            {title}
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

        <div className="max-h-[400px] overflow-y-auto overscroll-contain rounded-[10px] px-2 py-3">
          <div
            className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4"
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {filtered.map((opt, index) => {
              const isSelected = selectedSrc === opt.src;
              const isHovered = hoveredIndex === index;
              const scale = thumbnailHoverScale(index, hoveredIndex, cols);
              return (
                <button
                  key={opt.slug}
                  type="button"
                  onClick={() => setPending(opt)}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onFocus={() => setHoveredIndex(index)}
                  onBlur={() => setHoveredIndex((prev) => (prev === index ? null : prev))}
                  className={cn(
                    "relative flex flex-col items-center gap-1.5 rounded-lg p-1 text-center",
                    "origin-center motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                    isHovered && "z-10"
                  )}
                  style={{ transform: `scale(${scale})` }}
                  aria-pressed={isSelected}
                  aria-label={opt.label}
                >
                  <img
                    src={opt.src}
                    alt=""
                    className="h-24 w-24 object-contain sm:h-28 sm:w-28"
                    loading="lazy"
                  />
                  <span className="line-clamp-2 text-2xs font-medium leading-tight text-muted-foreground">
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
