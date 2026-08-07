import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TaskDetailScrollSection = {
  id: string;
  /** Section heading — string or custom node (e.g. Checklist + action). */
  title: ReactNode;
  content: ReactNode;
  /** Skip empty sections. */
  hidden?: boolean;
  /** Stronger surface treatment (e.g. Checklist). */
  elevated?: boolean;
};

export type TaskDetailContentProps = {
  /** When false, title is expected inside the hero overlay. */
  showTitle?: boolean;
  title: string;
  /** Hero image + readable metadata. */
  hero?: ReactNode;
  /** Description body — omit section when empty / heading false. */
  description?: ReactNode | null;
  descriptionHeading?: boolean | string;
  /** Hide the description block entirely. */
  hideDescription?: boolean;
  sections: TaskDetailScrollSection[];
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  /**
   * When false, this block does not own overflow — parent scrolls the full page
   * (hero → checklist → messaging → actions).
   */
  ownScroll?: boolean;
  className?: string;
};

/**
 * Single continuous task page.
 * Overview (hero + meta + description) → Checklist → (messaging / actions in parent).
 * (@Docs/05_Task_Engine.md §5.6; evidence lives in the hero).
 */
export function TaskDetailContent({
  showTitle = true,
  title,
  hero,
  description,
  descriptionHeading = "Description",
  hideDescription = false,
  sections,
  scrollRef,
  ownScroll = true,
  className,
}: TaskDetailContentProps) {
  const visibleSections = sections.filter((s) => !s.hidden);
  const showDescription = !hideDescription && description != null;

  return (
    <div
      ref={ownScroll ? scrollRef : undefined}
      className={cn(
        "flex flex-col justify-start",
        ownScroll
          ? "min-h-0 flex-1 overflow-y-auto [overflow-anchor:none]"
          : "shrink-0",
        className
      )}
    >
      {/* Hero bleeds full-width to the top of the panel / modal. */}
      {hero}

      <div className="space-y-6 px-5 pb-3 pt-4">
        {showTitle ? (
          <h2 className="text-xl font-semibold text-foreground leading-snug tracking-tight pr-2">
            {title}
          </h2>
        ) : null}

        {showDescription ? (
          <section className="space-y-2" aria-label="Description">
            {descriptionHeading ? (
              <h3 className="text-sm font-medium text-foreground">
                {typeof descriptionHeading === "string" ? descriptionHeading : "Description"}
              </h3>
            ) : null}
            {description}
          </section>
        ) : null}

        {visibleSections.map((section) => (
          <section
            key={section.id}
            id={`task-detail-${section.id}`}
            className={cn(
              "space-y-3",
              section.elevated &&
                "rounded-[12px] bg-muted/25 px-3.5 py-3.5 shadow-e1"
            )}
          >
            {section.title ? (
              typeof section.title === "string" ? (
                <h3 className="text-sm font-medium text-foreground">{section.title}</h3>
              ) : (
                <div className="text-sm font-medium text-foreground">{section.title}</div>
              )
            ) : null}
            {section.content}
          </section>
        ))}
      </div>
    </div>
  );
}
