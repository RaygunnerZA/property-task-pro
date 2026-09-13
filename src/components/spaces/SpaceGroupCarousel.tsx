import { useRef, type ReactNode } from "react";
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
};

/** Horizontal scroller for space group cards (matches onboarding Add Spaces layout). */
export function SpaceGroupCarousel({
  children,
  className,
  autoHeight = false,
}: SpaceGroupCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useTrackpadHorizontalElementScroll(scrollRef);

  return (
    <div className={className}>
      <div className="relative">
        <div
          ref={scrollRef}
          className={cn(
            "flex gap-3 overflow-x-auto rounded-tr-xl rounded-br-xl pt-2 pb-2 px-1 scrollbar-hz-teal shadow-[1px_0px_1px_0px_rgba(255,255,255,0.7)] overscroll-x-contain",
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
