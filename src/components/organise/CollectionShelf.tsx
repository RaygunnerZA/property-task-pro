import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTrackpadHorizontalElementScroll } from "@/hooks/useTrackpadHorizontalScroll";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/IconButton";

type CollectionShelfProps = {
  children: ReactNode;
  className?: string;
  prevLabel?: string;
  nextLabel?: string;
};

/**
 * Shelf — compact horizontal collection scroller with discreet prev/next
 * controls. Shared across Spaces, Assets, and Records (shelf–bench–drawer
 * grammar, @Docs/04_UI_System.md). Keeps a peek of the next card as an
 * affordance for more collections.
 */
export function CollectionShelf({
  children,
  className,
  prevLabel = "Previous",
  nextLabel = "Next",
}: CollectionShelfProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useTrackpadHorizontalElementScroll(scrollRef);

  const scrollByCard = (direction: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    const step = Math.min(220, Math.max(160, el.clientWidth * 0.42));
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  return (
    <div className={cn("relative", className)}>
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-0.5">
        <IconButton
          role="navigation"
          size={28}
          icon={<ChevronLeft className="h-3.5 w-3.5" />}
          tooltip={prevLabel}
          aria-label={prevLabel}
          className="pointer-events-auto opacity-80"
          onClick={() => scrollByCard(-1)}
        />
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center pr-0.5">
        <IconButton
          role="navigation"
          size={28}
          icon={<ChevronRight className="h-3.5 w-3.5" />}
          tooltip={nextLabel}
          aria-label={nextLabel}
          className="pointer-events-auto opacity-80"
          onClick={() => scrollByCard(1)}
        />
      </div>

      <div
        ref={scrollRef}
        className={cn(
          "flex gap-3.5 overflow-x-auto overscroll-x-contain px-8 py-2",
          "scrollbar-hz-teal items-start"
        )}
      >
        {children}
        {/* Trailing spacer so the last card can peek partially */}
        <div className="w-8 shrink-0" aria-hidden />
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-[5] w-[18px] bg-gradient-to-r from-transparent to-black/15"
        aria-hidden
      />
    </div>
  );
}
