import React from "react";
import { FilterChip } from "@/components/chips/filter";
import { ExpandingFilterIcon } from "@/components/ui/filters/ExpandingFilterIcon";
import { HoldToDrag, useFavouriteDrag } from "@/components/ui/filters/filterFavouriteDrag";
import { sameFavourite, type FilterFavourite } from "@/lib/filterFavourites";
import { cn } from "@/lib/utils";

export type FavouriteChipView = {
  item: FilterFavourite;
  label: string;
  selected: boolean;
  onActivate: () => void;
  icon?: React.ReactNode;
  iconClassName?: string;
  selectedSurfaceClassName?: string;
  selectedIconClassName?: string;
  selectedLabelClassName?: string;
};

const PRESSED_SURFACE =
  "rounded-[10px] bg-card/50 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.12),inset_-1px_-1px_2px_rgba(255,255,255,0.6)]";

const PRESSED_SLOT =
  "h-[28px] w-[28px] shrink-0 rounded-[8px] bg-card shadow-[inset_2px_2px_4px_rgba(0,0,0,0.16),inset_-1px_-1px_2px_rgba(255,255,255,0.35)]";

const HINT_CLASS =
  "whitespace-nowrap font-mono text-[10px] uppercase tracking-wide text-muted-foreground/80";

export function RemoveFavouriteSlot() {
  const drag = useFavouriteDrag();
  if (drag?.drag?.source !== "favourite") return null;
  return (
    <div
      data-remove-favourite=""
      className={cn(
        "inline-flex h-[28px] shrink-0 items-center gap-1.5 rounded-[8px] pr-1",
        drag.drag.overRemove && PRESSED_SURFACE
      )}
    >
      <span className={PRESSED_SLOT} aria-hidden />
      <span className={HINT_CLASS}>Remove from Favourite</span>
    </div>
  );
}

type FilterFavouritesRowProps = {
  chips: FavouriteChipView[];
  leading?: React.ReactNode;
};

export function FilterFavouritesRow({ chips, leading }: FilterFavouritesRowProps) {
  const drag = useFavouriteDrag();
  const active = drag?.drag ?? null;
  const showRow = chips.length > 0 || Boolean(leading) || Boolean(active);
  if (!showRow) return null;

  const placeholderAt = active?.hideSource && active.overRow ? active.insertIndex : -1;
  let visibleIndex = 0;

  return (
    <div
      data-favourites-row=""
      className={cn(
        "min-h-[36px]",
        active && PRESSED_SURFACE
      )}
    >
      <div className="chip-row-scroll flex min-w-0 items-center gap-[5px] py-[5px] pl-[3px] pr-2">
        {leading}
        {chips.map((chip) => {
          const lifting =
            Boolean(active?.hideSource) &&
            active?.source === "favourite" &&
            sameFavourite(active.item, chip.item);
          const showGap = !lifting && placeholderAt === visibleIndex;
          if (!lifting) visibleIndex += 1;
          return (
            <React.Fragment key={`${chip.item.kind}:${chip.item.id}`}>
              {showGap ? <span className={PRESSED_SLOT} aria-hidden /> : null}
              <HoldToDrag item={chip.item} source="favourite" label={chip.label} inRow>
                {chip.icon ? (
                  <ExpandingFilterIcon
                    label={chip.label}
                    selected={chip.selected}
                    onClick={chip.onActivate}
                    icon={chip.icon}
                    iconClassName={chip.iconClassName}
                    selectedSurfaceClassName={chip.selectedSurfaceClassName}
                    selectedIconClassName={chip.selectedIconClassName}
                    selectedLabelClassName={chip.selectedLabelClassName}
                  />
                ) : (
                  <FilterChip
                    label={chip.label}
                    selected={chip.selected}
                    onSelect={chip.onActivate}
                    className="!duration-300 ease-out"
                  />
                )}
              </HoldToDrag>
            </React.Fragment>
          );
        })}
        {placeholderAt >= visibleIndex ? <span className={PRESSED_SLOT} aria-hidden /> : null}
      </div>
      {active ? (
        <p className={cn(HINT_CLASS, "px-1 pt-1")}>Drag to arrange favourites</p>
      ) : null}
    </div>
  );
}
