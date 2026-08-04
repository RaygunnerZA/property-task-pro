import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TaskDetailScrollSection = {
  id: string;
  title: string;
  content: ReactNode;
  /** Skip empty sections (e.g. no checklist). */
  hidden?: boolean;
};

export type TaskDetailContentProps = {
  title: string;
  /** Large hero image + optional secondary thumbs. */
  hero?: ReactNode;
  /** Status / Property / Assignee / Reporter / Due chips. */
  contextChips?: ReactNode;
  /** AI-enriched “Filla understood” strip. */
  fillaUnderstood?: ReactNode;
  /** Description (+ optional inline edit chip row). */
  description: ReactNode;
  sections: TaskDetailScrollSection[];
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
};

/**
 * Single-scroll task detail body.
 * Constitutional contexts (Overview → Checklist → Evidence → Activity/Timeline)
 * are preserved as stacked sections rather than tabs (@Docs/05_Task_Engine.md §5.6).
 */
export function TaskDetailContent({
  title,
  hero,
  contextChips,
  fillaUnderstood,
  description,
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
      <div className="px-4 pt-5 pb-6 space-y-6">
        <header className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground leading-snug tracking-tight pr-2 pt-1">
            {title}
          </h2>
          {hero}
          {contextChips}
          {fillaUnderstood}
        </header>

        <section className="space-y-2" aria-label="Description">
          <h3 className="font-mono text-caption uppercase tracking-wide text-muted-foreground">
            Description
          </h3>
          {description}
        </section>

        {visibleSections.map((section) => (
          <section key={section.id} id={`task-detail-${section.id}`} className="space-y-2">
            <h3 className="font-mono text-caption uppercase tracking-wide text-muted-foreground">
              {section.title}
            </h3>
            {section.content}
          </section>
        ))}
      </div>
    </div>
  );
}
