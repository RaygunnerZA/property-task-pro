import { useState, type ReactNode } from "react";
import { Camera, Edit2, X } from "lucide-react";
import {
  META_CHIP_CLASS,
  META_CHIP_FILLED_CLASS,
} from "@/lib/metaChips";
import { TASK_DETAIL_HERO_UNDERLAY } from "@/hooks/usePropertyHeroSettle";
import {
  HeroThumbnailStack,
  HERO_THUMB_INSET_PX,
  HERO_THUMB_PX,
  HERO_THUMB_STACK_STEP_PX,
} from "@/components/detail/HeroThumbnailStack";
import { cn } from "@/lib/utils";
import type { TaskSignalChip } from "@/lib/taskSignalChip";

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

/** @deprecated Use TaskSignalChip from `@/lib/taskSignalChip`. */
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
  /**
   * Merged priority + due signal (EXPIRED → OVERDUE → URGENT → DUE SOON).
   * Replaces separate priorityUrgent / urgencyChip props.
   */
  signalChip?: TaskSignalChip | null;
  /** Theme / category tags after status chips. */
  tagLabels?: string[];
  /** e.g. "Created by Justin • Today 14:32" */
  contextLine?: string | null;
  counts?: TaskDetailStatusCounts;
  /** HorizontalOverflowRow / IntakeChipRow under the image (who / where / when…). */
  metaRow?: ReactNode;
  /** Kept for callers; hero opacity no longer lifts on hover or while the editor is open. */
  imageOpen?: boolean;
};

function statusFilledClass(tone: TaskDetailHeroMetaProps["statusTone"]): string {
  switch (tone) {
    case "open":
      // Solid raised chip (same geometry as overdue) — avoid translucent wash.
      return "bg-card text-muted-foreground";
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

function HeroMetaLine({
  contextLine,
  photoCount,
  tone,
  dimmed = false,
}: {
  contextLine?: string | null;
  photoCount: number;
  tone: "dark" | "light";
  dimmed?: boolean;
}) {
  if (!contextLine && photoCount <= 0) return null;
  return (
    <p
      className={cn(
        "flex min-w-0 items-center gap-x-1.5 text-[11px] transition-opacity duration-200 ease-out",
        tone === "dark" ? "text-white/70" : "text-muted-foreground",
        dimmed && "opacity-50"
      )}
    >
      {contextLine ? <span className="min-w-0 truncate">{contextLine}</span> : null}
      {contextLine && photoCount > 0 ? (
        <span className="shrink-0 opacity-80" aria-hidden>
          •
        </span>
      ) : null}
      <PhotoCountBadge count={photoCount} tone={tone} />
    </p>
  );
}

/** Coral fill — same as Urgent / brand destructive (#EB6834). */
const URGENCY_CORAL = "bg-[#EB6834] text-white";

function MetaChipRow({
  statusLabel,
  statusTone,
  signalChip,
  tagLabels,
}: {
  statusLabel: string;
  statusTone: TaskDetailHeroMetaProps["statusTone"];
  signalChip?: TaskSignalChip | null;
  tagLabels?: string[];
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className={cn(META_CHIP_FILLED_CLASS, statusFilledClass(statusTone))}>
        {statusLabel}
      </span>
      {signalChip ? (
        <span
          className={cn(
            META_CHIP_FILLED_CLASS,
            signalChip.tone === "coral" ? URGENCY_CORAL : "bg-amber-500 text-white"
          )}
        >
          {signalChip.kind === "due_soon"
            ? "Nearly due"
            : signalChip.kind === "overdue"
              ? "Overdue"
              : signalChip.kind === "urgent"
                ? "Urgent"
                : signalChip.kind === "high"
                  ? "High"
                  : "Expired"}
        </span>
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
  signalChip = null,
  tagLabels,
  contextLine,
  counts,
  metaRow,
}: TaskDetailHeroMetaProps) {
  const activeIndex = selectedIndex ?? 0;
  const hero = images[activeIndex] ?? images[0];
  const heroSrc = hero?.heroSrc || hero?.src;
  const hasHero = Boolean(heroSrc);
  const photoCount = counts?.photos ?? images.length;
  const collapsedStackWidth =
    images.length > 0
      ? HERO_THUMB_PX + Math.max(0, images.length - 1) * HERO_THUMB_STACK_STEP_PX
      : 0;
  const overlayPadRight =
    images.length > 0 ? HERO_THUMB_INSET_PX + collapsedStackWidth + 8 : 48;
  const [thumbsHovered, setThumbsHovered] = useState(false);

  const chipRow = (
    <MetaChipRow
      statusLabel={statusLabel}
      statusTone={statusTone}
      signalChip={signalChip}
      tagLabels={tagLabels}
    />
  );

  return (
    <div className="space-y-4">
      {hasHero ? (
        <div
          className="group relative w-full overflow-hidden"
          style={{ backgroundColor: TASK_DETAIL_HERO_UNDERLAY }}
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
              className="h-[min(22vh,168px)] w-full object-cover opacity-60"
            />
          </button>

          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(10.2deg, rgba(26, 44, 55, 0.74) 2%, rgba(0, 0, 0, 0) 41%)",
            }}
          />

          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 space-y-1.5 p-3 sm:p-3.5"
            style={{ paddingRight: overlayPadRight }}
          >
            <div className="pointer-events-auto min-w-0">{chipRow}</div>

            <h2
              className={cn(
                "text-lg font-semibold leading-snug tracking-tight text-white drop-shadow-sm sm:text-xl",
                "transition-opacity duration-200 ease-out",
                thumbsHovered && "opacity-50"
              )}
            >
              {title}
            </h2>

            <HeroMetaLine
              contextLine={contextLine}
              photoCount={photoCount}
              tone="dark"
              dimmed={thumbsHovered}
            />
          </div>

          <HeroThumbnailStack
            images={images}
            activeIndex={activeIndex}
            onSelectImage={onSelectImage}
            onOpenImage={onOpenImage}
            onHoverChange={setThumbsHovered}
          />

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
      ) : (
        <div className="relative px-5 pt-4">
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          {/* Shared left edge: chips + title stack without extra indent */}
          <div className="min-w-0 space-y-2.5 pr-10">
            {chipRow}
            <h2 className="text-xl font-semibold leading-snug tracking-tight text-foreground">
              {title}
            </h2>
            <HeroMetaLine contextLine={contextLine} photoCount={photoCount} tone="light" />
          </div>
        </div>
      )}

      {metaRow ? (
        <div className="space-y-3 px-5">
          {metaRow}
          <div className="perforation-section" aria-hidden />
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
