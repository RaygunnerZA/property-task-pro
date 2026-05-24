import { cn } from "@/lib/utils";

export type IssuesWorkbenchSectionHeaderProps = {
  title: string;
  subtitle?: string;
  illustrationSrc?: string;
  className?: string;
  /** Extra vertical margin for stacked signal sections (Urgent, Review, etc.). */
  spacious?: boolean;
};

/**
 * Issues workbench section title row: title | description | illustration.
 * Uses a responsive 3-column grid so copy wraps and art scales with pane width.
 */
export function IssuesWorkbenchSectionHeader({
  title,
  subtitle,
  illustrationSrc,
  className,
  spacious = false,
}: IssuesWorkbenchSectionHeaderProps) {
  const hasArt = Boolean(illustrationSrc);

  return (
    <div
      className={cn(
        "grid w-full min-w-0 items-start gap-x-3 gap-y-1 px-1",
        hasArt
          ? "grid-cols-[minmax(4.5rem,auto)_minmax(0,1fr)_minmax(3.5rem,min(6.25rem,26%))]"
          : "grid-cols-[minmax(4.5rem,auto)_minmax(0,1fr)]",
        spacious ? "my-5" : "my-0",
        className
      )}
    >
      <h2 className="min-w-0 w-[90px] text-lg font-semibold leading-tight tracking-wide text-[rgb(42,41,62)]">
        {title}
      </h2>

      {subtitle ? (
        <p className="min-w-0 pt-[5px] text-[11px] leading-snug text-muted-foreground sm:text-xs">
          {subtitle}
        </p>
      ) : (
        <span className="min-w-0" aria-hidden />
      )}

      {hasArt ? (
        <div className="flex aspect-square w-full max-h-[6.25rem] max-w-[6.25rem] items-end justify-end justify-self-end">
          <img
            src={illustrationSrc}
            alt=""
            className="mb-[-2px] mt-[-2px] h-full w-full overflow-hidden object-contain object-bottom drop-shadow-sm"
            decoding="async"
          />
        </div>
      ) : null}
    </div>
  );
}
