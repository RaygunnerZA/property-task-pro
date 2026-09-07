import { cn } from "@/lib/utils";

type ReportIllustrationProps = {
  src: string;
  alt?: string;
  className?: string;
  /** Soft brand wash behind the cut-out illustration. */
  washClassName?: string;
  imgClassName?: string;
};

/**
 * Report art with paper grain — white plate removed from the PNG assets.
 */
export function ReportIllustration({
  src,
  alt = "",
  className,
  washClassName,
  imgClassName,
}: ReportIllustrationProps) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-xl",
        washClassName,
        className
      )}
    >
      <img
        src={src}
        alt={alt}
        decoding="async"
        loading="lazy"
        className={cn(
          "relative z-[1] h-full w-full object-contain p-2",
          imgClassName
        )}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[2] bg-paper-texture opacity-55 mix-blend-multiply"
      />
    </div>
  );
}
