import type { ReactNode } from "react";

type SpaceGroupCarouselProps = {
  children: ReactNode;
  className?: string;
};

/** Horizontal scroller for space group cards (matches onboarding Add Spaces layout). */
export function SpaceGroupCarousel({ children, className }: SpaceGroupCarouselProps) {
  return (
    <div className={className}>
      <div className="relative">
        <div className="flex h-[310px] gap-3 overflow-x-auto rounded-tr-xl rounded-br-xl pt-2 pb-2 px-1 scrollbar-hz-teal shadow-[1px_0px_1px_0px_rgba(255,255,255,0.7)]">
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
