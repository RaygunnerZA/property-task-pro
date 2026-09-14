import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Children } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared “Recent” rail language (Tasks · Calendar · Records · Spaces · Assets).
 *
 * Reference lock: calendar day-cell pressed paper (inset shadow + grain).
 * One surface per row — no outer card wrapping inner cards.
 */

export function RecentPanel({
  title,
  action,
  children,
  empty,
  className,
  listClassName,
}: {
  title: string;
  action?: ReactNode;
  children?: ReactNode;
  /** Pass `null` to suppress the default empty copy (e.g. while loading). */
  empty?: ReactNode | null;
  className?: string;
  listClassName?: string;
}) {
  const items = Children.toArray(children);
  const hasItems = items.length > 0;

  return (
    <div className={cn("w-full min-w-0", className)}>
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
        <p className="font-mono text-2xs font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
          {title}
        </p>
        {action ? <div className="flex shrink-0 items-center gap-1">{action}</div> : null}
      </div>
      {hasItems ? (
        <ul className={cn("flex flex-col gap-1.5", listClassName)}>{items}</ul>
      ) : empty === null ? null : (
        empty ?? (
          <p className="px-0.5 text-caption text-muted-foreground">Nothing recent yet.</p>
        )
      )}
    </div>
  );
}

export type RecentPanelRowProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  icon?: ReactNode;
  title: ReactNode;
  caption?: ReactNode;
  trailing?: ReactNode;
  selected?: boolean;
  /** Non-interactive row (no button). */
  nonInteractive?: boolean;
};

export function RecentPanelRow({
  icon,
  title,
  caption,
  trailing,
  selected = false,
  nonInteractive = false,
  className,
  type = "button",
  ...props
}: RecentPanelRowProps) {
  const body = (
    <>
      {icon ? (
        <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-[6px] text-muted-foreground">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium leading-tight text-foreground">
          {title}
        </span>
        {caption ? (
          <span className="mt-0.5 block truncate text-caption text-muted-foreground">{caption}</span>
        ) : null}
      </span>
      {trailing ? <span className="shrink-0">{trailing}</span> : null}
    </>
  );

  const shellClass = cn(
    "recent-panel-row flex w-full items-center gap-2.5 px-2.5 py-2 text-left",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
    className
  );

  return (
    <li>
      {nonInteractive ? (
        <div className={shellClass} data-selected={selected || undefined}>
          {body}
        </div>
      ) : (
        <button
          type={type}
          className={shellClass}
          data-selected={selected || undefined}
          {...props}
        >
          {body}
        </button>
      )}
    </li>
  );
}
