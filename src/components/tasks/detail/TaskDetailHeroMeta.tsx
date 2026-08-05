import type { ReactNode } from "react";
import { Camera, Edit2, Plus } from "lucide-react";
import { UserAvatar } from "@/components/tasks/UserAvatar";
import type { TaskPersonAvatar } from "@/lib/userDisplayHelpers";
import { cn } from "@/lib/utils";

export type TaskDetailImageThumb = {
  id: string;
  src: string;
  alt?: string;
  heroSrc?: string;
};

type TaskDetailHeroMetaProps = {
  title: string;
  images: TaskDetailImageThumb[];
  selectedIndex: number | null;
  onSelectImage: (index: number) => void;
  onOpenImage?: (index: number) => void;
  onAddEvidence?: () => void;
  isUploadingEvidence?: boolean;
  statusLabel: string;
  statusTone?: "open" | "progress" | "review" | "done" | "other";
  dueLabel?: string | null;
  locationLabel?: string | null;
  assigner?: TaskPersonAvatar | null;
  assignee?: TaskPersonAvatar | null;
};

function statusOverlayClass(tone: TaskDetailHeroMetaProps["statusTone"]): string {
  switch (tone) {
    case "open":
      return "bg-success-vivid/95 text-white";
    case "progress":
      return "bg-primary/95 text-primary-foreground";
    case "review":
      return "bg-warning/95 text-warning-foreground";
    case "done":
      return "bg-black/55 text-white";
    default:
      return "bg-black/45 text-white";
  }
}

function MetaRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1 py-1.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function PersonCell({ person }: { person: TaskPersonAvatar }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <UserAvatar
        imageUrl={person.imageUrl}
        name={person.name}
        propertyColor={person.accentColor}
        size={22}
        shape="card"
        className="!h-[22px] !w-[22px] !min-h-[22px] !min-w-[22px] rounded-[7px]"
      />
      <span className="truncate">{person.name || "Unknown"}</span>
    </span>
  );
}

/**
 * Compact evidence hero + readable metadata for Task Detail.
 * Title / status / due / location overlay the image; chips are replaced by a definition list.
 */
export function TaskDetailHeroMeta({
  title,
  images,
  selectedIndex,
  onSelectImage,
  onOpenImage,
  onAddEvidence,
  isUploadingEvidence = false,
  statusLabel,
  statusTone = "other",
  dueLabel,
  locationLabel,
  assigner,
  assignee,
}: TaskDetailHeroMetaProps) {
  const activeIndex = selectedIndex ?? 0;
  const hero = images[activeIndex] ?? images[0];
  const heroSrc = hero?.heroSrc || hero?.src;
  const hasHero = Boolean(heroSrc);
  const evidenceCount = images.length;

  return (
    <div className="space-y-6">
      {hasHero ? (
        <div className="space-y-3">
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
                className="h-[min(25vh,192px)] w-full object-cover"
              />
            </button>

            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, rgba(20, 28, 45, 0.15) 0%, rgba(20, 28, 45, 0.08) 35%, rgba(20, 28, 45, 0.72) 100%)",
              }}
            />

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 space-y-2 p-3.5 pr-14">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide",
                    statusOverlayClass(statusTone)
                  )}
                >
                  {statusLabel}
                </span>
                {dueLabel ? (
                  <span className="inline-flex items-center rounded-md bg-black/35 px-2 py-0.5 text-[11px] font-medium text-white/95 backdrop-blur-[2px]">
                    {dueLabel}
                  </span>
                ) : null}
                {locationLabel ? (
                  <span className="inline-flex max-w-full items-center truncate rounded-md bg-black/35 px-2 py-0.5 text-[11px] font-medium text-white/95 backdrop-blur-[2px]">
                    {locationLabel}
                  </span>
                ) : null}
              </div>
              <h2 className="text-lg font-semibold leading-snug tracking-tight text-white drop-shadow-sm sm:text-xl">
                {title}
              </h2>
            </div>

            <div className="absolute right-2 top-2 z-20 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
                <Camera className="h-3 w-3" aria-hidden />
                {evidenceCount}
              </span>
              {onAddEvidence ? (
                <button
                  type="button"
                  onClick={onAddEvidence}
                  disabled={isUploadingEvidence}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-opacity hover:bg-black/55 disabled:opacity-60"
                  aria-label={isUploadingEvidence ? "Uploading evidence" : "Add evidence photo"}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onOpenImage?.(activeIndex)}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full",
                  "bg-black/40 text-white backdrop-blur-sm transition-opacity duration-200",
                  "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 hover:bg-black/55"
                )}
                aria-label="Edit image and annotations"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {images.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-hz-teal">
              {images.map((image, index) => {
                const selected = activeIndex === index;
                return (
                  <button
                    key={image.id || `${image.src}-${index}`}
                    type="button"
                    onClick={() => onSelectImage(index)}
                    className={cn(
                      "relative h-11 w-11 shrink-0 overflow-hidden rounded-[10px] bg-muted/40 transition-shadow",
                      selected
                        ? "ring-2 ring-primary shadow-e1"
                        : "shadow-e1 hover:ring-1 hover:ring-primary/30"
                    )}
                    aria-label={image.alt || `Evidence ${index + 1}`}
                    aria-pressed={selected}
                  >
                    <img src={image.src} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                );
              })}
              {onAddEvidence ? (
                <button
                  type="button"
                  onClick={onAddEvidence}
                  disabled={isUploadingEvidence}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-muted/40 text-muted-foreground shadow-e1 transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-60"
                  aria-label="Add evidence photo"
                >
                  <Plus className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold",
                statusTone === "open" && "bg-success-vivid text-white",
                statusTone === "progress" && "bg-primary text-primary-foreground",
                statusTone === "review" && "bg-warning text-warning-foreground",
                statusTone === "done" && "bg-muted text-muted-foreground",
                statusTone === "other" && "bg-muted text-foreground"
              )}
            >
              {statusLabel}
            </span>
            {dueLabel ? (
              <span className="text-sm text-muted-foreground">{dueLabel}</span>
            ) : null}
            {locationLabel ? (
              <span className="text-sm text-muted-foreground">{locationLabel}</span>
            ) : null}
          </div>
          <h2 className="text-xl font-semibold leading-snug tracking-tight text-foreground pr-2">
            {title}
          </h2>
          {onAddEvidence ? (
            <button
              type="button"
              onClick={onAddEvidence}
              disabled={isUploadingEvidence}
              className="inline-flex items-center gap-2 rounded-[10px] bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground shadow-e1 transition-colors hover:bg-muted/55 hover:text-foreground disabled:opacity-60"
            >
              <Camera className="h-4 w-4" aria-hidden />
              {isUploadingEvidence ? "Uploading…" : "Add evidence photo"}
            </button>
          ) : null}
        </div>
      )}

      <dl className="space-y-0.5 border-0">
        <MetaRow label="Assigned to">
          {assignee ? <PersonCell person={assignee} /> : <span className="text-muted-foreground">Unassigned</span>}
        </MetaRow>
        <MetaRow label="Created by">
          {assigner ? <PersonCell person={assigner} /> : <span className="text-muted-foreground">—</span>}
        </MetaRow>
        <MetaRow label="Due">
          {dueLabel ? dueLabel : <span className="text-muted-foreground">No due date</span>}
        </MetaRow>
        <MetaRow label="Location">
          {locationLabel ? locationLabel : <span className="text-muted-foreground">No location</span>}
        </MetaRow>
      </dl>
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
