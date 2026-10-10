import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { isPageTitleMinimised, minimisePageTitle } from "@/lib/ephemeralDescription";
import {
  workbenchPageTitleClassName,
  workbenchSectionSubtitleClassName,
  workbenchTitleBandLabelOffsetClassName,
} from "@/lib/workbenchSectionTitle";

export type WorkbenchSectionHeroProps = {
  title: string;
  description?: string;
  illustrationSrc: string;
  className?: string;
};

/** Large art stays up this long on the first view of the local day. */
const SHOW_MS = 7000;
/** Image tuck starts after the dissolve is underway, so the three parts don't move as one. */
const SHRINK_DELAY_MS = 200;

/**
 * Left-rail section hero — paper-craft art beside a debossed H1 + short description.
 * Shared by Tasks · Calendar · Records and Spaces · Assets · People.
 *
 * First view of each local day shows the large art, title, and description.
 * After 7s the description dissolves, then the art shrinks to 62px from the
 * top-left and the title slides left, keeping a 15px gap. Later visits that
 * day open already compact.
 *
 * Title baseline stays top-aligned (`py-3` + label offset) so centre list tabs
 * keep their alignment via workbenchTitleBandPtClassName.
 */
export function WorkbenchSectionHero({
  title,
  description,
  illustrationSrc,
  className,
}: WorkbenchSectionHeroProps) {
  const id = `screen:${title}`;
  const [dissolved, setDissolved] = useState(() => isPageTitleMinimised(id));
  const [compact, setCompact] = useState(() => isPageTitleMinimised(id));

  useEffect(() => {
    if (isPageTitleMinimised(id)) {
      setDissolved(true);
      setCompact(true);
      return;
    }
    setDissolved(false);
    setCompact(false);
    const dissolveTimer = window.setTimeout(() => {
      minimisePageTitle(id);
      setDissolved(true);
    }, SHOW_MS);
    const shrinkTimer = window.setTimeout(() => {
      setCompact(true);
    }, SHOW_MS + SHRINK_DELAY_MS);
    return () => {
      window.clearTimeout(dissolveTimer);
      window.clearTimeout(shrinkTimer);
    };
  }, [id]);

  return (
    <div
      className={cn("flex w-full items-start gap-[15px] rounded-2xl py-3", className)}
      data-page-title={title}
      data-page-title-state={compact ? "compact" : "full"}
    >
      <div
        className={cn(
          "relative flex shrink-0 origin-top-left items-center justify-center",
          "transition-[width,height] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
          compact
            ? "h-[62px] w-[62px]"
            : "h-[88px] w-[88px] sm:h-[108px] sm:w-[108px]"
        )}
        aria-hidden
      >
        <img
          src={illustrationSrc}
          alt=""
          width={108}
          height={108}
          decoding="async"
          className="h-full w-full object-contain object-left-top drop-shadow-sm"
        />
      </div>
      <div className={cn("min-w-0 flex-1", workbenchTitleBandLabelOffsetClassName)}>
        <h1 className={cn(workbenchPageTitleClassName, "font-medium")}>{title}</h1>
        {description ? (
          <div
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none",
              dissolved ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
            )}
            aria-hidden={dissolved}
          >
            <div className="min-h-0 overflow-hidden">
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** @deprecated Prefer WorkbenchSectionHero description style */
export const workbenchSectionHeroSubtitleClassName = workbenchSectionSubtitleClassName;
