import { useState } from "react";
import { cn } from "@/lib/utils";

export type HeroThumbImage = {
  id: string;
  src: string;
  alt?: string;
  heroSrc?: string;
};

const THUMB_PX = 50;
const THUMB_RADIUS_PX = 8;
const THUMB_STACK_STEP_PX = 25;
const THUMB_FAN_STEP_PX = 58;
export const HERO_THUMB_INSET_PX = 12;
export const HERO_THUMB_PX = THUMB_PX;
export const HERO_THUMB_STACK_STEP_PX = THUMB_STACK_STEP_PX;

export function heroThumbStackWidth(count: number, expanded = false): number {
  if (count <= 0) return 0;
  const step = expanded && count > 1 ? THUMB_FAN_STEP_PX : THUMB_STACK_STEP_PX;
  return THUMB_PX + Math.max(0, count - 1) * step;
}

type HeroThumbnailStackProps = {
  images: HeroThumbImage[];
  activeIndex: number;
  onSelectImage: (index: number) => void;
  onOpenImage?: (index: number) => void;
  onHoverChange?: (hovered: boolean) => void;
};

/**
 * Bottom-right overlapping thumbs — same stack as Task Detail.
 * Hover fans left; drop shadow sits to the right of every thumb except the last.
 */
export function HeroThumbnailStack({
  images,
  activeIndex,
  onSelectImage,
  onOpenImage,
  onHoverChange,
}: HeroThumbnailStackProps) {
  const [expanded, setExpanded] = useState(false);
  const count = images.length;
  if (count === 0) return null;

  const setHover = (next: boolean) => {
    setExpanded(next);
    onHoverChange?.(next);
  };

  const step = expanded && count > 1 ? THUMB_FAN_STEP_PX : THUMB_STACK_STEP_PX;
  const stackWidth = THUMB_PX + Math.max(0, count - 1) * step;

  return (
    <div
      className="absolute z-20"
      style={{ right: HERO_THUMB_INSET_PX, bottom: HERO_THUMB_INSET_PX, width: stackWidth, height: THUMB_PX }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setHover(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setHover(false);
        }
      }}
    >
      {images.map((image, index) => {
        const selected = activeIndex === index;
        const isBottom = index === count - 1;
        return (
          <button
            key={image.id || `${image.src}-${index}`}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onSelectImage(index);
              onOpenImage?.(index);
            }}
            className={cn(
              "absolute top-0 overflow-hidden bg-muted/40 ring-1 ring-black/15 transition-[right] duration-200 ease-out motion-reduce:transition-none",
              selected ? "ring-2 ring-white/90" : "hover:ring-white/50",
              !isBottom && "shadow-[4px_0_6px_rgba(0,0,0,0.28)]"
            )}
            style={{
              width: THUMB_PX,
              height: THUMB_PX,
              borderRadius: THUMB_RADIUS_PX,
              right: (count - 1 - index) * step,
              zIndex: count - index,
            }}
            aria-label={image.alt || `Open photo ${index + 1}`}
          >
            <img
              src={image.src}
              alt=""
              className="h-full w-full object-cover"
              width={THUMB_PX}
              height={THUMB_PX}
              loading="lazy"
            />
          </button>
        );
      })}
    </div>
  );
}
