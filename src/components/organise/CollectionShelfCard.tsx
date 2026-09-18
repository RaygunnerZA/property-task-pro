import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const DASHED_LINE_STYLE = {
  height: "1px",
  backgroundImage:
    "repeating-linear-gradient(to right, #E2DBCB 0px, #E2DBCB 4px, transparent 4px, transparent 7px)",
  backgroundSize: "7px 1px",
  backgroundRepeat: "repeat-x" as const,
};

export type CollectionShelfCardProps = {
  label: string;
  /** Description — fades in as the card scrolls into the shelf viewport. */
  description: string;
  /** Paper-cut collection illustration. */
  imageSrc: string;
  /** Collection colour (count pill background). */
  color: string;
  count: number;
  /** Singular noun for the count line, e.g. "document" | "space" | "asset". */
  countNoun: string;
  attentionCount?: number;
  attentionLabel?: string;
  selected?: boolean;
  onSelect: () => void;
  className?: string;
};

/**
 * Shelf card — compact paper-cut collection card shared by Spaces, Assets,
 * and Records. Cards scope the bench below; they never open detail
 * (shelf–bench–drawer grammar, @Docs/04_UI_System.md).
 */
export function CollectionShelfCard({
  label,
  description,
  imageSrc,
  color,
  count,
  countNoun: _countNoun,
  attentionCount = 0,
  attentionLabel = "need attention",
  selected = false,
  onSelect,
  className,
}: CollectionShelfCardProps) {
  const cardRef = useRef<HTMLButtonElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const root =
      el.closest<HTMLElement>("[data-collection-shelf-scroll]") ?? null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting && entry.intersectionRatio >= 0.45);
      },
      {
        root,
        threshold: [0, 0.45, 0.75, 1],
        rootMargin: "0px -12px 0px -12px",
      }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const descriptionVisible = inView;

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group flex h-[210px] w-[min(42vw,200px)] shrink-0 flex-col bg-transparent text-left sm:w-[200px]",
        "transition-transform duration-200 hover:scale-[1.02] active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className
      )}
    >
      <div className="relative h-[112px] w-full shrink-0 overflow-hidden rounded-t-[10px]">
        <img
          src={imageSrc}
          alt=""
          decoding="async"
          className="h-full w-full object-cover object-center"
        />
        <span className="sr-only">{label}</span>
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-1.5 rounded-b-[10px] bg-card px-2.5 pb-2 pt-1.5 shadow-e1",
          "transition-shadow duration-200",
          selected &&
            "shadow-md ring-1 ring-primary/70 ring-offset-1 ring-offset-[hsl(var(--background))]"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold leading-snug text-foreground">{label}</h3>
          <span
            className="mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wider text-white"
            style={{ backgroundColor: color }}
            aria-label={`${count} items`}
          >
            {count}
          </span>
        </div>
        <div className="-mx-0.5" style={DASHED_LINE_STYLE} aria-hidden />
        {attentionCount > 0 && !selected ? (
          <p
            className={cn(
              "font-mono text-2xs uppercase tracking-wide text-destructive",
              "transition-opacity duration-300 ease-out",
              inView ? "opacity-100" : "opacity-0"
            )}
          >
            {attentionCount} {attentionLabel}
          </p>
        ) : null}
        {/* Height reserved on every card; fades in as the card enters the shelf */}
        <p
          className={cn(
            "line-clamp-2 min-h-[2.5rem] flex-1 text-xs leading-snug text-muted-foreground",
            "transition-opacity duration-300 ease-out",
            descriptionVisible ? "opacity-100" : "opacity-0"
          )}
          aria-hidden={!descriptionVisible}
        >
          {description}
        </p>
      </div>
    </button>
  );
}

/**
 * Compact trailing shelf card for creating a custom collection inline.
 */
export function NewCollectionShelfCard({
  placeholder,
  onCreate,
  className,
}: {
  placeholder: string;
  onCreate: (name: string) => void;
  className?: string;
}) {
  const [name, setName] = useState("");

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setName("");
  };

  return (
    <div
      className={cn(
        "flex h-[210px] w-[min(42vw,200px)] shrink-0 flex-col justify-between rounded-[10px]",
        "border border-dashed border-border/70 bg-card/50 px-2.5 py-2.5",
        className
      )}
    >
      <p className="font-mono text-2xs uppercase tracking-wide text-muted-foreground">
        New collection
      </p>
      <div className="mt-2 space-y-1.5">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          className="w-full rounded-[8px] border-0 bg-background/80 px-2 py-1.5 text-xs shadow-[inset_1px_2px_4px_rgba(0,0,0,0.06)] focus:outline-none focus:ring-1 focus:ring-primary/40"
          aria-label="New collection name"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim()}
          className={cn(
            "inline-flex w-full items-center justify-center gap-1 rounded-[8px] bg-primary/15 px-2 py-1",
            "font-mono text-2xs uppercase tracking-wide text-foreground",
            "hover:bg-primary/25 disabled:opacity-50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          )}
        >
          <Plus className="h-3 w-3" />
          Create
        </button>
      </div>
    </div>
  );
}
