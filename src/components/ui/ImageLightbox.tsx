import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ImageLightboxItem = {
  src: string;
  alt?: string;
  /** Optional fallback if primary src fails to load */
  fallbackSrc?: string;
  /**
   * Drawn over the image (e.g. annotation SVG).
   * Prefer a function so overlays can match the photo aspect ratio and avoid warping.
   */
  overlay?: ReactNode | ((ctx: { aspectRatio: number }) => ReactNode);
};

type ImageLightboxProps = {
  open: boolean;
  images: ImageLightboxItem[];
  index: number;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
  title?: string;
  headerAction?: ReactNode;
  className?: string;
};

/**
 * In-app image preview. Closes on backdrop / Esc. Does not open a new window.
 */
export function ImageLightbox({
  open,
  images,
  index,
  onClose,
  onIndexChange,
  title = "Image",
  headerAction,
  className,
}: ImageLightboxProps) {
  const count = images.length;
  const safeIndex = count > 0 ? ((index % count) + count) % count : 0;
  const current = count > 0 ? images[safeIndex] : null;
  const [aspectRatio, setAspectRatio] = useState(1);

  useEffect(() => {
    setAspectRatio(1);
  }, [current?.src]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (!onIndexChange || count < 2) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onIndexChange((safeIndex - 1 + count) % count);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        onIndexChange((safeIndex + 1) % count);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onIndexChange, safeIndex, count]);

  if (!open || !current || typeof document === "undefined") return null;

  const overlayNode =
    typeof current.overlay === "function"
      ? current.overlay({ aspectRatio })
      : current.overlay;

  return createPortal(
    <div
      className={cn("modal-scrim fixed inset-0 z-[9999] flex flex-col", className)}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header
        className="relative z-20 flex shrink-0 items-center gap-2 border-b border-white/10 bg-black/50 px-3 py-2.5 backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{title}</p>
          <p className="truncate text-xs text-white/55">
            {count > 1 ? `${safeIndex + 1} / ${count} · ` : null}
            Esc to close
          </p>
        </div>
        {headerAction}
      </header>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-6"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {count > 1 && onIndexChange ? (
          <>
            <button
              type="button"
              className="absolute left-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60 sm:left-4"
              onClick={(e) => {
                e.stopPropagation();
                onIndexChange((safeIndex - 1 + count) % count);
              }}
              aria-label="Previous image"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              className="absolute right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60 sm:right-4"
              onClick={(e) => {
                e.stopPropagation();
                onIndexChange((safeIndex + 1) % count);
              }}
              aria-label="Next image"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        ) : null}

        <div
          className="relative inline-block max-h-full max-w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src={current.src}
            alt={current.alt || title}
            className="block max-h-[calc(100dvh-7rem)] max-w-full rounded-md object-contain shadow-lg"
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                setAspectRatio(img.naturalWidth / img.naturalHeight);
              }
            }}
            onError={(e) => {
              if (
                current.fallbackSrc &&
                (e.target as HTMLImageElement).src !== current.fallbackSrc
              ) {
                (e.target as HTMLImageElement).src = current.fallbackSrc;
              }
            }}
          />
          {overlayNode ? (
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-md">
              {overlayNode}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
