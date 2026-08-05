import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TaskDetailScrollSection = {
  id: string;
  /** Section heading — string or custom node (e.g. Checklist + action). */
  title: ReactNode;
  content: ReactNode;
  /** Skip empty sections. */
  hidden?: boolean;
};

export type TaskDetailContentProps = {
  /** When false, title is expected inside the hero overlay. */
  showTitle?: boolean;
  title: string;
  /** Hero image + readable metadata. */
  hero?: ReactNode;
  /** Description body — omit section heading when `descriptionHeading` is false. */
  description: ReactNode;
  descriptionHeading?: boolean | string;
  sections: TaskDetailScrollSection[];
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
};

/**
 * Single continuous task page.
 * Overview (hero + meta + description) → Checklist → Activity
 * (@Docs/05_Task_Engine.md §5.6; evidence lives in the hero).
 */
export function TaskDetailContent({
  showTitle = true,
  title,
  hero,
  description,
  descriptionHeading = "Description",
  sections,
  scrollRef,
  className,
}: TaskDetailContentProps) {
  const visibleSections = sections.filter((s) => !s.hidden);

  return (
    <div
      ref={scrollRef}
      className={cn("flex-1 overflow-y-auto min-h-0 flex flex-col", className)}
    >
      <div className="px-5 pt-5 pb-20 space-y-8">
        <header className="space-y-6">
          {showTitle ? (
            <h2 className="text-xl font-semibold text-foreground leading-snug tracking-tight pr-2">
              {title}
            </h2>
          ) : null}
          {hero}
        </header>

        <section className="space-y-3" aria-label="Description">
          {descriptionHeading ? (
            <h3 className="text-sm font-medium text-foreground">
              {typeof descriptionHeading === "string" ? descriptionHeading : "Description"}
            </h3>
          ) : null}
          {description}
        </section>

        {visibleSections.map((section) => (
          <section
            key={section.id}
            id={`task-detail-${section.id}`}
            className="space-y-3"
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
