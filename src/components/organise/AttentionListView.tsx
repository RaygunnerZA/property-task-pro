import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AttentionSection = {
  id: string;
  title: string;
  /** Small line under the title — e.g. area name, space name, or count. */
  subtitle?: string | null;
  /** Illustration / photo thumb shown above the title in the left rail. */
  iconSrc?: string | null;
  /** Fallback when no image — e.g. a lucide icon or coloured coin. */
  icon?: ReactNode;
  accentColor?: string;
  onOpen?: () => void;
  /** Right-hand content — task cards or document rows. */
  content: ReactNode;
};

type AttentionListViewProps = {
  sections: AttentionSection[];
  emptyState?: ReactNode;
  className?: string;
};

/**
 * Attention view — the Schedule pattern rotated onto places: the left rail
 * shows the entity (icon above name) instead of day/date; the right side
 * lists the open work (@Docs/04_UI_System.md — organise views).
 */
export function AttentionListView({ sections, emptyState, className }: AttentionListViewProps) {
  if (sections.length === 0) {
    return (
      <div className={cn("py-10 text-center text-sm text-muted-foreground", className)}>
        {emptyState ?? "Nothing needs attention right now."}
      </div>
    );
  }

  return (
    <div className={cn("min-w-0", className)}>
      {sections.map((section, index) => (
        <div key={section.id} className="min-w-0">
          {index > 0 ? (
            <div className="my-4" aria-hidden>
              <div className="perforation-list" />
            </div>
          ) : null}
          <div className="flex min-w-0 items-start gap-3">
            {/* Left rail — centred entity icon above name (Schedule's day/date slot) */}
            <div className="w-[81px] flex-shrink-0 pt-1 sm:w-[5.5rem]">
              <button
                type="button"
                onClick={section.onOpen}
                disabled={!section.onOpen}
                className={cn(
                  "flex w-full flex-col items-center gap-1.5 rounded-[10px] p-1 text-center",
                  section.onOpen &&
                    "transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                )}
              >
                <span
                  className="flex h-[45px] w-[45px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-card shadow-e1"
                  style={
                    section.accentColor
                      ? { backgroundColor: `${section.accentColor}22` }
                      : undefined
                  }
                >
                  {section.iconSrc ? (
                    <img
                      src={section.iconSrc}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-muted-foreground [&_svg]:h-5 [&_svg]:w-5">
                      {section.icon}
                    </span>
                  )}
                </span>
                <span className="min-w-0 w-full">
                  <span className="block text-[14px] font-semibold leading-tight text-foreground [overflow-wrap:anywhere]">
                    {section.title}
                  </span>
                  {section.subtitle ? (
                    <span className="block pt-0.5 text-2xs font-medium leading-tight text-primary">
                      {section.subtitle}
                    </span>
                  ) : null}
                </span>
              </button>
            </div>

            {/* Right — open work for this entity */}
            <div className="min-w-0 flex-1 space-y-3 pb-1">{section.content}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
