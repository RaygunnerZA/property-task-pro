import { cn } from "@/lib/utils";

const BANNER_INNER_SHADOW =
  "inset 1px 1px 1px 0px rgba(255, 255, 255, 0.87), inset -1px -1px 2px 0px rgba(0, 0, 0, 0.1), 3px 0px 6px 0px rgba(0, 0, 0, 0.15)";

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
      className={cn("relative w-full h-[130px] overflow-hidden", className)}
      style={{ backgroundColor: imageSrc ? undefined : color }}
    >
      {imageSrc ? (
        <img src={imageSrc} alt="" className="h-full w-full object-cover object-center" decoding="async" />
      ) : null}
      <div
        className="pointer-events-none absolute inset-0 rounded-t-[8px]"
        style={{
          boxShadow: BANNER_INNER_SHADOW,
          color: "rgba(41, 39, 53, 0.87)",
        }}
        aria-hidden
      />
      <span className="sr-only">{alt}</span>
    </div>
  );
}
