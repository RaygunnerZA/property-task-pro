import { cn } from "@/lib/utils";
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

/**
 * Left-rail section hero — large paper-craft art beside a debossed H1 + short description.
 * Shared by Tasks · Calendar · Records and Spaces · Assets · People.
 *
 * Title baseline is locked: fixed art frame + top-aligned type, so different asset
 * aspect ratios or subtitle lengths do not shift the H1. Top padding (`py-3`) matches
 * centre list tabs via workbenchTitleBandPtClassName.
 */
export function WorkbenchSectionHero({
  title,
  description,
  illustrationSrc,
  className,
}: WorkbenchSectionHeroProps) {
  return (
    <div
      className={cn(
        "grid w-full grid-cols-[88px_minmax(0,1fr)] items-start gap-3 rounded-2xl py-3 sm:grid-cols-[108px_minmax(0,1fr)] sm:gap-4",
        className
      )}
    >
      <div
        className="relative flex h-[88px] w-[88px] items-center justify-center sm:h-[108px] sm:w-[108px]"
        aria-hidden
      >
        <img
          src={illustrationSrc}
          alt=""
          width={108}
          height={108}
          decoding="async"
          className="h-full w-full object-contain object-center drop-shadow-sm"
        />
      </div>
      <div className={cn("min-w-0", workbenchTitleBandLabelOffsetClassName)}>
        <h1 className={cn(workbenchPageTitleClassName, "font-medium")}>{title}</h1>
        {description ? (
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

/** @deprecated Prefer WorkbenchSectionHero description style */
export const workbenchSectionHeroSubtitleClassName = workbenchSectionSubtitleClassName;
