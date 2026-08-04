import { Camera, Clock, MapPin, User, AlertTriangle, Package } from "lucide-react";
import { UserAvatar, TASK_CARD_META_CHIP_SIZE } from "@/components/tasks/UserAvatar";
import type { TaskPersonAvatar } from "@/lib/userDisplayHelpers";
import { cn } from "@/lib/utils";
import { SemanticChip } from "@/components/chips/semantic/SemanticChip";

export type TaskDetailImageThumb = {
  id: string;
  src: string;
  alt?: string;
  heroSrc?: string;
};

type TaskDetailHeroMetaProps = {
  images: TaskDetailImageThumb[];
  selectedIndex: number | null;
  onSelectImage: (index: number) => void;
  onOpenImage?: (index: number) => void;
  statusLabel: string;
  statusClassName?: string;
  urgent?: boolean;
  dueLabel?: string | null;
  propertyLabel?: string | null;
  spaceLabel?: string | null;
  assignee?: TaskPersonAvatar | null;
  reporter?: TaskPersonAvatar | null;
};

const chipClass =
  "inline-flex h-7 max-w-full items-center gap-1.5 rounded-card bg-card px-2.5 font-mono text-caption font-medium uppercase tracking-wide shadow-e1";

/**
 * Hero image + context chips (Status, Property, Assignee, Reporter, Due).
 * Replaces the old thumb strip + From/For meta row.
 */
export function TaskDetailHeroMeta({
  images,
  selectedIndex,
  onSelectImage,
  onOpenImage,
  statusLabel,
  statusClassName,
  urgent = false,
  dueLabel,
  propertyLabel,
  spaceLabel,
  assignee,
  reporter,
}: TaskDetailHeroMetaProps) {
  const activeIndex = selectedIndex ?? 0;
  const hero = images[activeIndex] ?? images[0];
  const heroSrc = hero?.heroSrc || hero?.src;

  return (
    <div className="space-y-3">
      {heroSrc ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onOpenImage?.(activeIndex)}
            className="relative w-full overflow-hidden rounded-[12px] bg-muted/40 shadow-e1"
            aria-label={hero?.alt || "Task image"}
          >
            <img
              src={heroSrc}
              alt={hero?.alt || ""}
              className="max-h-[min(42vh,320px)] w-full object-cover"
            />
          </button>
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
                      "relative h-12 w-12 shrink-0 overflow-hidden rounded-[10px] bg-muted/40 transition-shadow",
                      selected
                        ? "ring-2 ring-primary shadow-e1"
                        : "shadow-e1 hover:ring-1 hover:ring-primary/30"
                    )}
                    aria-label={image.alt || `Task image ${index + 1}`}
                    aria-pressed={selected}
                  >
                    <img src={image.src} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={cn(chipClass, statusClassName)}>{statusLabel}</span>
        {urgent ? <span className={cn(chipClass, "text-destructive")}>Urgent</span> : null}
        {propertyLabel ? (
          <span className={chipClass}>
            <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">{propertyLabel}</span>
          </span>
        ) : null}
        {spaceLabel ? (
          <span className={cn(chipClass, "normal-case tracking-normal")}>
            <span className="truncate font-mono text-caption uppercase tracking-wide">{spaceLabel}</span>
          </span>
        ) : null}
        {assignee ? (
          <span
            className={cn(chipClass, "normal-case tracking-normal pr-1.5")}
            title={assignee.name ? `Assignee ${assignee.name}` : "Assignee"}
          >
            <span className="text-muted-foreground">Assignee</span>
            <UserAvatar
              imageUrl={assignee.imageUrl}
              name={assignee.name}
              propertyColor={assignee.accentColor}
              size={TASK_CARD_META_CHIP_SIZE}
              shape="card"
            />
          </span>
        ) : null}
        {reporter ? (
          <span
            className={cn(chipClass, "normal-case tracking-normal pr-1.5")}
            title={reporter.name ? `Reporter ${reporter.name}` : "Reporter"}
          >
            <span className="text-muted-foreground">Reporter</span>
            <UserAvatar
              imageUrl={reporter.imageUrl}
              name={reporter.name}
              propertyColor={reporter.accentColor}
              size={TASK_CARD_META_CHIP_SIZE}
              shape="card"
            />
          </span>
        ) : null}
        {dueLabel ? (
          <span className={chipClass}>
            <Clock className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            {dueLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** @deprecated Prefer TaskDetailHeroMeta — kept for any leftover imports. */
export const TaskDetailMediaMeta = TaskDetailHeroMeta;

export type FillaUnderstoodItem = {
  id: string;
  label: string;
  kind: "person" | "location" | "date" | "asset" | "priority" | "other";
  present: boolean;
};

type TaskDetailFillaUnderstoodProps = {
  items: FillaUnderstoodItem[];
  className?: string;
};

const KIND_ICON = {
  person: User,
  location: MapPin,
  date: Clock,
  asset: Package,
  priority: AlertTriangle,
  other: Camera,
} as const;

/**
 * Shows what Filla extracted for this task and flags gaps.
 */
export function TaskDetailFillaUnderstood({ items, className }: TaskDetailFillaUnderstoodProps) {
  if (items.length === 0) return null;
  const missing = items.filter((i) => !i.present);

  return (
    <div className={cn("rounded-[12px] bg-muted/30 px-3 py-2.5 space-y-2 shadow-sm", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-mono text-caption uppercase tracking-wide text-muted-foreground">
          Filla understood
        </h3>
        {missing.length > 0 ? (
          <span className="font-mono text-2xs uppercase tracking-wide text-warning-foreground">
            {missing.length} missing
          </span>
        ) : (
          <span className="font-mono text-2xs uppercase tracking-wide text-success-foreground">
            Complete
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const Icon = KIND_ICON[item.kind];
          return (
            <SemanticChip
              key={item.id}
              epistemic={item.present ? "fact" : "proposal"}
              label={item.label}
              truncate={false}
              icon={<Icon className="h-3 w-3" aria-hidden />}
              className={cn(
                "h-6 max-w-none text-caption py-0",
                !item.present && "opacity-70 ring-1 ring-dashed ring-muted-foreground/30"
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

export type TaskDetailRelatedLink = {
  id: string;
  label: string;
  href: string;
  kind: "property" | "space" | "asset" | "record";
};

type TaskDetailRelatedProps = {
  links: TaskDetailRelatedLink[];
  className?: string;
};

export function TaskDetailRelated({ links, className }: TaskDetailRelatedProps) {
  if (links.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {links.map((link) => (
        <a
          key={link.id}
          href={link.href}
          className={cn(
            chipClass,
            "hover:bg-muted/50 transition-colors no-underline text-foreground"
          )}
        >
          <span className="text-muted-foreground normal-case tracking-normal">
            {link.kind === "property"
              ? "Property"
              : link.kind === "space"
                ? "Space"
                : link.kind === "asset"
                  ? "Asset"
                  : "Record"}
          </span>
          <span className="truncate">{link.label}</span>
        </a>
      ))}
    </div>
  );
}
