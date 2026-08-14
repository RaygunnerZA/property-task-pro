import { useState } from "react";
import { Camera, X } from "lucide-react";
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

export type AssetDetailImageThumb = {
  id: string;
  src: string;
  heroSrc?: string;
  alt?: string;
};

type AssetDetailHeroProps = {
  title: string;
  images: AssetDetailImageThumb[];
  selectedIndex: number;
  onSelectImage: (index: number) => void;
  /** Open full-size preview for an image (hero or thumbnail). */
  onOpenImage?: (index: number) => void;
  onAddPhoto: () => void;
  onClose: () => void;
  statusLabel: string;
  statusTone?: "active" | "inactive" | "retired" | "other";
  conditionLabel?: string | null;
  typeLabel?: string | null;
  contextLine?: string | null;
  isUploading?: boolean;
};

function statusFilledClass(tone: AssetDetailHeroProps["statusTone"]): string {
  switch (tone) {
    case "active":
      return "bg-success-vivid text-white";
    case "inactive":
      return "bg-warning-vivid text-white";
    case "retired":
      return "bg-card text-muted-foreground";
    default:
      return "bg-card text-foreground";
  }
}

function ChipRow({
  statusLabel,
  statusTone,
  conditionLabel,
  typeLabel,
}: {
  statusLabel: string;
  statusTone: AssetDetailHeroProps["statusTone"];
  conditionLabel?: string | null;
  typeLabel?: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className={cn(META_CHIP_FILLED_CLASS, statusFilledClass(statusTone))}>
        {statusLabel}
      </span>
      {conditionLabel ? (
        <span className={META_CHIP_CLASS}>{conditionLabel}</span>
      ) : null}
      {typeLabel ? <span className={META_CHIP_CLASS}>{typeLabel}</span> : null}
    </div>
  );
}

/**
 * Image-led asset identity — same hero treatment as Task Detail.
 * Photo is the primary identifier; empty state is an honest add-photo slot.
 */
export function AssetDetailHero({
  title,
  images,
  selectedIndex,
  onSelectImage,
  onOpenImage,
  onAddPhoto,
  onClose,
  statusLabel,
  statusTone = "other",
  conditionLabel,
  typeLabel,
  contextLine,
  isUploading = false,
}: AssetDetailHeroProps) {
  const [thumbsHovered, setThumbsHovered] = useState(false);
  const hero = images[selectedIndex] ?? images[0];
  const heroSrc = hero?.heroSrc || hero?.src;
  const hasHero = Boolean(heroSrc);
  const photoCount = images.length;
  const collapsedStackWidth =
    images.length > 0
      ? HERO_THUMB_PX + Math.max(0, images.length - 1) * HERO_THUMB_STACK_STEP_PX
      : 0;
  const overlayPadRight =
    images.length > 0 ? HERO_THUMB_INSET_PX + collapsedStackWidth + 8 : 48;

  const chipRow = (
    <ChipRow
      statusLabel={statusLabel}
      statusTone={statusTone}
      conditionLabel={conditionLabel}
      typeLabel={typeLabel}
    />
  );

  const closeButton = (
    <button
      type="button"
      onClick={onClose}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md",
        hasHero
          ? "bg-black/35 text-white/95 backdrop-blur-[1px] hover:bg-black/50 focus-visible:ring-white/40"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-ring",
        "focus-visible:outline-none focus-visible:ring-2"
      )}
      aria-label="Close"
    >
      <X className="h-4 w-4" />
    </button>
  );

  const addPhotoButton = (
    <button
      type="button"
      onClick={onAddPhoto}
      disabled={isUploading}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full",
        hasHero
          ? "bg-black/35 text-white/95 backdrop-blur-[1px] hover:bg-black/50 focus-visible:ring-white/40"
          : "bg-card text-muted-foreground shadow-e1 hover:text-foreground focus-visible:ring-ring",
        "opacity-0 focus-visible:opacity-100 group-hover:opacity-100",
        "focus-visible:outline-none focus-visible:ring-2",
        "disabled:pointer-events-none disabled:opacity-50"
      )}
      aria-label={hasHero ? "Add photo" : "Add asset photo"}
    >
      <Camera className="h-3.5 w-3.5" />
    </button>
  );

  if (!hasHero) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={onAddPhoto}
          disabled={isUploading}
          className="group relative block w-full overflow-hidden text-left disabled:pointer-events-none"
          style={{ backgroundColor: TASK_DETAIL_HERO_UNDERLAY }}
          aria-label="Add asset photo"
        >
          <div className="flex h-[min(22vh,168px)] w-full flex-col items-center justify-center gap-2">
            <Camera className="h-6 w-6 text-white/80" aria-hidden />
            <span className="text-sm font-medium text-white/90">
              {isUploading ? "Uploading…" : "Add photo"}
            </span>
          </div>
        </button>
        <div className="absolute right-2 top-2 z-20">{closeButton}</div>
        <div className="space-y-2 px-5 pt-3 pb-1">
          {chipRow}
          <h2 className="text-xl font-semibold leading-snug tracking-tight text-foreground">
            {title}
          </h2>
          {contextLine ? (
            <p className="truncate text-[11px] text-muted-foreground">{contextLine}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="group relative w-full overflow-hidden" style={{ backgroundColor: TASK_DETAIL_HERO_UNDERLAY }}>
      <button
        type="button"
        onClick={() => {
          onSelectImage(selectedIndex);
          onOpenImage?.(selectedIndex);
        }}
        className="block w-full cursor-zoom-in text-left"
        aria-label="Open photo"
      >
        <img
          src={heroSrc}
          alt={hero?.alt || title}
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
        {contextLine || photoCount > 0 ? (
          <p
            className={cn(
              "flex min-w-0 items-center gap-x-1.5 text-[11px] text-white/70 transition-opacity duration-200 ease-out",
              thumbsHovered && "opacity-50"
            )}
          >
            {contextLine ? <span className="min-w-0 truncate">{contextLine}</span> : null}
            {contextLine && photoCount > 0 ? (
              <span className="shrink-0 opacity-80" aria-hidden>
                •
              </span>
            ) : null}
            {photoCount > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-1 tabular-nums" title="Photos">
                <Camera className="h-3 w-3" aria-hidden />
                <span>{photoCount}</span>
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
      <HeroThumbnailStack
        images={images}
        activeIndex={selectedIndex}
        onSelectImage={onSelectImage}
        onOpenImage={onOpenImage}
        onHoverChange={setThumbsHovered}
      />
      <div className="absolute right-2 top-2 z-20 flex items-center gap-1.5">
        {addPhotoButton}
        {closeButton}
      </div>
    </div>
  );
}
