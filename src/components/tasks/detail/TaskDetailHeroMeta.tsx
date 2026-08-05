import type { ReactNode } from "react";
import { Camera, CheckSquare, Edit2, MessageSquare } from "lucide-react";
import { UserAvatar } from "@/components/tasks/UserAvatar";
import type { TaskPersonAvatar } from "@/lib/userDisplayHelpers";
import {
  META_CHIP_CLASS,
  META_CHIP_FILLED_CLASS,
} from "@/lib/metaChips";
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
  statusLabel: string;
  statusTone?: "open" | "progress" | "review" | "done" | "other";
  /** Priority urgent chip next to status. */
  priorityUrgent?: boolean;
  /** Due urgency chip: OVERDUE or NEARLY DUE. */
  urgencyChip?: TaskDetailUrgencyChip;
  /** Theme / category tags after status chips. */
  tagLabels?: string[];
  dueLabel?: string | null;
  /** Space or property shown under LOCATION. */
  locationLabel?: string | null;
  /** e.g. "Created by Justin • Today 14:32" */
  contextLine?: string | null;
  counts?: TaskDetailStatusCounts;
  assigner?: TaskPersonAvatar | null;
  assignee?: TaskPersonAvatar | null;
};

function statusFilledClass(tone: TaskDetailHeroMetaProps["statusTone"]): string {
  switch (tone) {
    case "open":
      return "bg-success-vivid text-white";
    case "progress":
      return "bg-primary text-primary-foreground";
    case "review":
      return "bg-warning text-warning-foreground";
    case "done":
      return "bg-muted text-muted-foreground";
    default:
      return "bg-card text-foreground";
  }
}

function PersonCell({ person }: { person: TaskPersonAvatar }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <UserAvatar
        imageUrl={person.imageUrl}
        name={person.name}
        propertyColor={person.accentColor}
        size={20}
        shape="card"
        className="!h-5 !w-5 !min-h-5 !min-w-5 rounded-[6px]"
      />
      <span className="truncate">{person.name || "Unknown"}</span>
    </span>
  );
}

function StatusCounts({
  counts,
  tone = "dark",
}: {
  counts?: TaskDetailStatusCounts;
  tone?: "dark" | "light";
}) {
  if (!counts) return null;
  const items: { key: string; icon: ReactNode; value: number; label: string }[] = [];
  if ((counts.photos ?? 0) > 0) {
    items.push({
      key: "photos",
      icon: <Camera className="h-3 w-3" aria-hidden />,
      value: counts.photos!,
      label: "Photos",
    });
  }
  if ((counts.checklist ?? 0) > 0) {
    items.push({
      key: "checklist",
      icon: <CheckSquare className="h-3 w-3" aria-hidden />,
      value: counts.checklist!,
      label: "Checklist items",
    });
  }
  if ((counts.comments ?? 0) > 0) {
    items.push({
      key: "comments",
      icon: <MessageSquare className="h-3 w-3" aria-hidden />,
      value: counts.comments!,
      label: "Comments",
    });
  }
  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]",
        tone === "dark" ? "text-white/75" : "text-muted-foreground"
      )}
    >
      {items.map((item) => (
        <span key={item.key} className="inline-flex items-center gap-1" title={item.label}>
          {item.icon}
          <span className="tabular-nums">{item.value}</span>
          <span className="sr-only">{item.label}</span>
        </span>
      ))}
    </div>
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
    <div className="flex flex-wrap items-center gap-1.5">
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
 * Compact evidence hero + Assigned / Due / Location metadata for Task Detail.
 */
export function TaskDetailHeroMeta({
  title,
  images,
  selectedIndex,
  onSelectImage,
  onOpenImage,
  statusLabel,
  statusTone = "other",
  priorityUrgent = false,
  urgencyChip = null,
  tagLabels,
  dueLabel,
  locationLabel,
  contextLine,
  counts,
  assignee,
}: TaskDetailHeroMetaProps) {
  const activeIndex = selectedIndex ?? 0;
  const hero = images[activeIndex] ?? images[0];
  const heroSrc = hero?.heroSrc || hero?.src;
  const hasHero = Boolean(heroSrc);

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
          <div className="group relative w-full overflow-hidden rounded-[12px] bg-muted/40 shadow-e1">
            <button
              type="button"
              onClick={() => onOpenImage?.(activeIndex)}
              className="block w-full text-left"
              aria-label={hero?.alt || "Task evidence"}
            >
              <img
                src={heroSrc}
                alt={hero?.alt || ""}
                className="h-[min(22vh,168px)] w-full object-cover"
              />
            </button>

            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(20, 28, 45, 0.12) 0%, rgba(20, 28, 45, 0.05) 40%, rgba(20, 28, 45, 0.78) 100%)",
              }}
            />

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 space-y-1.5 p-3 pr-12 sm:p-3.5">
              <div className="pointer-events-auto">{chipRow}</div>

              <h2 className="text-lg font-semibold leading-snug tracking-tight text-white drop-shadow-sm sm:text-xl">
                {title}
              </h2>

              {contextLine ? (
                <p className="truncate text-[11px] text-white/70">{contextLine}</p>
              ) : null}

              <StatusCounts counts={counts} tone="dark" />
            </div>

            <div className="absolute right-2 top-2 z-20 flex items-center gap-1 opacity-70 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => onOpenImage?.(activeIndex)}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full",
                  "bg-black/25 text-white/90 backdrop-blur-[1px] transition-opacity duration-200",
                  "opacity-0 focus-visible:opacity-100 group-hover:opacity-100 hover:bg-black/40",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                )}
                aria-label="Edit image and annotations"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {images.length > 1 ? (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hz-teal">
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
        <div className="space-y-3">
          {chipRow}

          <h2 className="text-xl font-semibold leading-snug tracking-tight text-foreground pr-2">
            {title}
          </h2>

          {contextLine ? (
            <p className="text-xs text-muted-foreground">{contextLine}</p>
          ) : null}

          <StatusCounts counts={counts} tone="light" />
        </div>
      )}

      <div className="space-y-3">
        <dl className="grid grid-cols-3 gap-x-3 gap-y-2">
          <div className="min-w-0 space-y-0.5">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Assigned to
            </dt>
            <dd className="min-w-0 text-sm text-foreground">
              {assignee ? (
                <PersonCell person={assignee} />
              ) : (
                <span className="text-muted-foreground">Unassigned</span>
              )}
            </dd>
          </div>
          <div className="min-w-0 space-y-0.5">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Due
            </dt>
            <dd className="min-w-0 text-sm text-foreground">
              {dueLabel ? dueLabel : <span className="text-muted-foreground">No due date</span>}
            </dd>
          </div>
          <div className="min-w-0 space-y-0.5">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Location
            </dt>
            <dd className="min-w-0 truncate text-sm text-foreground">
              {locationLabel ? (
                locationLabel
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </dd>
          </div>
        </dl>
        <div className="border-t border-white/60" aria-hidden />
      </div>
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
