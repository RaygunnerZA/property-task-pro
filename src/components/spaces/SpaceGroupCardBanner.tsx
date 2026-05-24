import { cn } from "@/lib/utils";

const BANNER_INNER_SHADOW =
  "inset 2px 2px 4px rgba(255, 255, 255, 0.6), inset -1px -1px 2px rgba(0, 0, 0, 0.1), 3px 0px 6px rgba(0, 0, 0, 0.15)";

interface SpaceGroupCardBannerProps {
  imageSrc?: string;
  alt: string;
  /** Fallback when no image (group accent color). */
  color?: string;
  className?: string;
}

/** Illustration strip above space group card titles (neumorphic top-left inner shadow). */
export function SpaceGroupCardBanner({
  imageSrc,
  alt,
  color = "#8EC9CE",
  className,
}: SpaceGroupCardBannerProps) {
  return (
    <div
      className={cn("relative w-full h-[63px] overflow-hidden", className)}
      style={{ backgroundColor: imageSrc ? undefined : color }}
    >
      {imageSrc ? (
        <img src={imageSrc} alt="" className="h-full w-full object-cover object-center" decoding="async" />
      ) : null}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: BANNER_INNER_SHADOW }}
        aria-hidden
      />
      <span className="sr-only">{alt}</span>
    </div>
  );
}
