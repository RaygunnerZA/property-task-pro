import * as React from "react";

import { cn } from "@/lib/utils";

/** Shared classes for in-card / panel section headings (sentence case, ink, one step below page titles). */
export const panelSectionTitleClassName =
  "text-base font-semibold tracking-tight text-ink mb-2";

export type PanelSectionTitleProps = React.HTMLAttributes<HTMLHeadingElement> & {
  as?: "h2" | "h3" | "h4";
};

export function PanelSectionTitle({
  as: Comp = "h3",
  className,
  ...props
}: PanelSectionTitleProps) {
  return <Comp className={cn(panelSectionTitleClassName, className)} {...props} />;
}
