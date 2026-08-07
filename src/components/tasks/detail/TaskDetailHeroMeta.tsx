import type { ReactNode } from "react";
import { Camera, Edit2, X } from "lucide-react";
import {
  META_CHIP_CLASS,
  META_CHIP_FILLED_CLASS,
} from "@/lib/metaChips";
import { PROPERTY_HERO_UNDERLAY } from "@/hooks/usePropertyHeroSettle";
import { cn } from "@/lib/utils";

export type TaskDetailImageThumb = {
  id: string;
  src: string;
  alt?: string;
  heroSrc?: string;
};

export type TaskDetailStatusCounts = {
  photos?: number;
  checklist?: number;
  comments?: number;
};

export type TaskDetailUrgencyChip = "overdue" | "nearly_due" | null;

type TaskDetailHeroMetaProps = {
  title: string;
  images: TaskDetailImageThumb[];
  selectedIndex: number | null;
  onSelectImage: (index: number) => void;
  onOpenImage?: (index: number) => void;
  /** Close control in the hero toolbar — avoids stacking under Dialog’s absolute X. */
  onClose?: () => void;
  statusLabel: string;
  statusTone?: "open" | "progress" | "review" | "done" | "other";
  /** Priority urgent chip next to status. */
  priorityUrgent?: boolean;
  /** Due urgency chip: OVERDUE or NEARLY DUE. */
  urgencyChip?: TaskDetailUrgencyChip;
  /** Theme / category tags after status chips. */
  tagLabels?: string[];
  /** e.g. "Created by Justin • Today 14:32" */
  contextLine?: string | null;
  counts?: TaskDetailStatusCounts;
  /** HorizontalOverflowRow / IntakeChipRow under the image (who / where / when…). */
  metaRow?: ReactNode;
  /** Lightbox / annotation open — image at full opacity (same as hover). */
  imageOpen?: boolean;
};

function statusFilledClass(tone: TaskDetailHeroMetaProps["statusTone"]): string {
  switch (tone) {
    case "open":
      return "bg-muted-foreground/15 text-muted-foreground";
    case "progress":
      return "bg-blue-500 text-white";
    case "review":
      return "bg-amber-500 text-white";
    case "done":
      return "bg-success-vivid text-white";
    default:
      return "bg-card text-foreground";
  }
}

function PhotoCountBadge({
  count,
  tone = "dark",
}: {
  count: number;
  tone?: "dark" | "light";
}) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-[11px] tabular-nums",
        tone === "dark" ? "text-white/80" : "text-muted-foreground"
      )}
      title="Photos"
    >
      <Camera className="h-3 w-3" aria-hidden />
      <span>{count}</span>
      <span className="sr-only">Photos</span>
    </span>
  );
}

function MetaChipRow({
  statusLabel,
  statusTone,
  priorityUrgent,
  urgencyChip,
  tagLabels,
}: {
  statusLabel: string;
  statusTone: TaskDetailHeroMetaProps["statusTone"];
  priorityUrgent?: boolean;
  urgencyChip?: TaskDetailUrgencyChip;
  tagLabels?: string[];
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className={cn(META_CHIP_FILLED_CLASS, statusFilledClass(statusTone))}>
        {statusLabel}
      </span>
      {priorityUrgent ? (
        <span className={cn(META_CHIP_FILLED_CLASS, "bg-[#EB6834] text-white")}>Urgent</span>
      ) : null}
      {urgencyChip === "overdue" ? (
        <span className={cn(META_CHIP_FILLED_CLASS, "bg-destructive text-destructive-foreground")}>
          Overdue
        </span>
      ) : null}
      {urgencyChip === "nearly_due" ? (
        <span className={cn(META_CHIP_FILLED_CLASS, "bg-amber-500 text-white")}>Nearly due</span>
      ) : null}
      {(tagLabels ?? []).map((tag) => (
        <span key={tag} className={META_CHIP_CLASS}>
          {tag}
        </span>
      ))}
    </div>
  );
}

/**
 * Compact evidence hero + HorizontalOverflowRow metadata for Task Detail.
 */
export function TaskDetailHeroMeta({
  title,
  images,
  selectedIndex,
  onSelectImage,
  onOpenImage,
  onClose,
  statusLabel,
  statusTone = "other",
  priorityUrgent = false,
  urgencyChip = null,
  tagLabels,
  contextLine,
  counts,
  metaRow,
  imageOpen = false,
}: TaskDetailHeroMetaProps) {
  const activeIndex = selectedIndex ?? 0;
  const hero = images[activeIndex] ?? images[0];
  const heroSrc = hero?.heroSrc || hero?.src;
  const hasHero = Boolean(heroSrc);
  const photoCount = counts?.photos ?? 0;

  const chipRow = (
    <MetaChipRow
      statusLabel={statusLabel}
      statusTone={statusTone}
      priorityUrgent={priorityUrgent}
      urgencyChip={urgencyChip}
      tagLabels={tagLabels}
    />
  );

  return (
    <div className="space-y-4">
      {hasHero ? (
        <div className="space-y-2.5">
          {/* Full-bleed to panel/modal top; turquoise shows through at rest opacity. */}
          <div
            className="group relative w-full overflow-hidden"
            style={{ backgroundColor: PROPERTY_HERO_UNDERLAY }}
          >
            <button
              type="button"
              onClick={() => onOpenImage?.(activeIndex)}
              className="block w-full text-left"
              aria-label={hero?.alt || "Task evidence"}
            >
              <img
                src={heroSrc}
                alt={hero?.alt || ""}
                className={cn(
                  "h-[min(22vh,168px)] w-full object-cover transition-opacity duration-200 ease-out",
                  imageOpen
                    ? "opacity-100"
                    : "opacity-60 group-hover:opacity-100 group-focus-within:opacity-100"
                )}
              />
            </button>

            <div
              className="pointer-events-none absolute inset-0"
              style={{
                // Same angled wash as dashboard property card heroes.
                background:
                  "linear-gradient(10.2deg, rgba(26, 44, 55, 0.74) 2%, rgba(0, 0, 0, 0) 41%)",
              }}
            />

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 space-y-1.5 p-3 pr-12 sm:p-3.5">
              <div className="pointer-events-auto min-w-0">{chipRow}</div>

              <h2 className="text-lg font-semibold leading-snug tracking-tight text-white drop-shadow-sm sm:text-xl">
                {title}
              </h2>

              {contextLine || photoCount > 0 ? (
                <div className="flex min-w-0 items-center justify-between gap-2">
                  {contextLine ? (
                    <p className="min-w-0 truncate text-[11px] text-white/70">{contextLine}</p>
                  ) : (
                    <span />
                  )}
                  <PhotoCountBadge count={photoCount} tone="dark" />
                </div>
              ) : null}
            </div>

            <div className="absolute right-2 top-2 z-20 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onOpenImage?.(activeIndex)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  "bg-black/35 text-white/95 backdrop-blur-[1px] transition-opacity duration-200",
                  "opacity-0 focus-visible:opacity-100 group-hover:opacity-100 hover:bg-black/50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                )}
                aria-label="Edit image and annotations"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md",
                    "bg-black/35 text-white/95 backdrop-blur-[1px] transition-colors",
                    "hover:bg-black/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  )}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>

          {images.length > 1 ? (
            <div className="flex gap-1.5 overflow-x-auto px-5 pb-0.5 scrollbar-hz-teal">
              {images.map((image, index) => {
                const selected = activeIndex === index;
                return (
                  <button
                    key={image.id || `${image.src}-${index}`}
                    type="button"
                    onClick={() => onSelectImage(index)}
                    className={cn(
                      "relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-muted/30 transition-shadow",
                      selected
                        ? "ring-2 ring-primary/80 shadow-sm"
                        : "opacity-80 hover:opacity-100 hover:ring-1 hover:ring-primary/25"
                    )}
                    aria-label={image.alt || `Evidence ${index + 1}`}
                    aria-pressed={selected}
                  >
                    <img src={image.src} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3 px-5 pt-4">
          {onClose ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          <div className="min-w-0">{chipRow}</div>

          <h2 className="text-xl font-semibold leading-snug tracking-tight text-foreground pr-2">
            {title}
          </h2>

          {contextLine || photoCount > 0 ? (
            <div className="flex min-w-0 items-center justify-between gap-2">
              {contextLine ? (
                <p className="min-w-0 truncate text-xs text-muted-foreground">{contextLine}</p>
              ) : (
                <span />
              )}
              <PhotoCountBadge count={photoCount} tone="light" />
            </div>
          ) : null}
        </div>
      )}

      {metaRow ? (
        <div className="space-y-3 px-5">
          {metaRow}
          <div className="border-t border-white/60" aria-hidden />
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Prefer TaskDetailHeroMeta */
export const TaskDetailMediaMeta = TaskDetailHeroMeta;

export type FillaUnderstoodItem = {
  id: string;
  label: string;
  kind: "person" | "location" | "date" | "asset" | "priority" | "other";
  present: boolean;
};

/** @deprecated Removed from Task Detail layout — kept for import stability. */
export function TaskDetailFillaUnderstood(_props: {
  items: FillaUnderstoodItem[];
  className?: string;
}): ReactNode {
  return null;
}

export type TaskDetailRelatedLink = {
  id: string;
  label: string;
  href: string;
  kind: "property" | "space" | "asset" | "record";
};

/** @deprecated Related section removed from Task Detail. */
export function TaskDetailRelated(_props: {
  links: TaskDetailRelatedLink[];
  className?: string;
}): ReactNode {
  return null;
}
