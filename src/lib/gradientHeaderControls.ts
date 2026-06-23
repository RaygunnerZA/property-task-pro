import { cn } from "@/lib/utils";

/** Frosted square control on the property-colour gradient strip (search / filter / avatar). */
export function gradientHeaderControlClassName(className?: string) {
  return cn(
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]",
    "bg-white/70 shadow-e1",
    "outline-none transition-shadow hover:shadow-md",
    "focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-1",
    className
  );
}

/** Desktop gradient-header search field chrome. */
export function gradientHeaderSearchFieldClassName(className?: string) {
  return cn(
    "flex min-w-0 flex-1 items-stretch overflow-hidden rounded-[12px]",
    "bg-white/70 shadow-e1",
    className
  );
}

/** Desktop gradient-header filter button chrome. */
export function gradientHeaderFilterButtonClassName(className?: string) {
  return cn(
    "inline-flex shrink-0 items-center gap-1.5 rounded-[12px]",
    "bg-white/70 px-3 py-2 text-sm font-medium text-foreground shadow-e1",
    "transition-shadow hover:shadow-md",
    className
  );
}
