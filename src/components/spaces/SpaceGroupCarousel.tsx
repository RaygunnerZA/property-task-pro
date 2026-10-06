import { useRef, type ReactNode, type UIEvent } from "react";
import { useTrackpadHorizontalElementScroll } from "@/hooks/useTrackpadHorizontalScroll";
import { cn } from "@/lib/utils";

type SpaceGroupCarouselProps = {
  children: ReactNode;
  className?: string;
  /**
   * Follow card content height instead of the fixed 310px strip.
   * Use for record category cards that expand description on hover.
   */
  autoHeight?: boolean;
  /** Fires when the horizontal scroller moves (e.g. dismiss progressive overlays). */
  onScroll?: (event: UIEvent<HTMLDivElement>) => void;
};

/** Horizontal scroller for space group cards (matches onboarding Add Spaces layout). */
export function SpaceGroupCarousel({
  children,
  className,
  autoHeight = false,
  onScroll,
}: SpaceGroupCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useTrackpadHorizontalElementScroll(scrollRef);

  return (
    <div className={cn("min-w-0 max-w-full", className)}>
      <div className="relative min-w-0 max-w-full">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className={cn(
            "flex w-full min-w-0 max-w-full gap-3 overflow-x-auto rounded-tr-xl rounded-br-xl px-1 pb-2 pr-4 pt-2 scrollbar-hz-teal shadow-[1px_0px_1px_0px_rgba(255,255,255,0.7)] overscroll-x-contain",
            autoHeight ? "h-auto items-start" : "h-[310px]"
          )}
        >
          {children}
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-20 w-[14px] rounded-tr-xl rounded-br-xl bg-gradient-to-r from-transparent to-black/20"
          aria-hidden
        />
      </div>
    </div>
  );
}
