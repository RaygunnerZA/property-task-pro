import { getPropertyChipIcon } from "@/lib/propertyChipIcons";
import type { PropertySelectorRowProperty } from "@/components/properties/PropertySelectorRow";
import { cn } from "@/lib/utils";

type PropertySelectorAllThumbnailProps = {
  properties: PropertySelectorRowProperty[];
  /** `header` = compact grid for gradient-header trigger; `row` = list row thumbnail. */
  size?: "header" | "row";
  className?: string;
};

const ROW_SIZE = { width: 56, height: 72, icon: 22 } as const;

/** Property icons for the "All Properties" selector — header grid or stacked row thumbnail. */
export function PropertySelectorAllThumbnail({
  properties,
  size = "row",
  className,
}: PropertySelectorAllThumbnailProps) {
  if (size === "header") {
    const icons = properties.slice(0, 9);
    const useSingleRowThreeCols = icons.length === 3;
    const useDenseThreeColumnGrid = icons.length > 4;

    return (
      <div
        className={cn(
          "grid shrink-0",
          useSingleRowThreeCols && "grid-cols-3 grid-rows-1 gap-1 h-5 w-[61px]",
          useDenseThreeColumnGrid && "grid-cols-3 gap-px",
          !useSingleRowThreeCols &&
            !useDenseThreeColumnGrid &&
            "grid-cols-2 gap-0.5",
          className
        )}
        aria-hidden
      >
        {icons.map((property) => {
          const Icon = getPropertyChipIcon(property.icon_name || "home");
          return (
            <Icon
              key={property.id}
              className={cn(
                "shrink-0 text-white",
                useDenseThreeColumnGrid
                  ? "h-2.5 w-2.5"
                  : useSingleRowThreeCols
                    ? "size-[18px]"
                    : "h-3.5 w-3.5"
              )}
            />
          );
        })}
      </div>
    );
  }

  const { width, height, icon: iconSize } = ROW_SIZE;
  const icons = properties.slice(0, 6);
  const count = icons.length;
  const step = count <= 1 ? 0 : (width - iconSize) / (count - 1);

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-[6px] bg-muted/50",
        className
      )}
      style={{ width, height }}
      aria-hidden
    >
      {icons.map((property, index) => {
        const Icon = getPropertyChipIcon(property.icon_name || "home");
        const color = property.icon_color_hex || "#8EC9CE";
        const left = count <= 1 ? (width - iconSize) / 2 : index * step;

        return (
          <div
            key={property.id}
            className="absolute flex items-center justify-center rounded-full shadow-sm"
            style={{
              width: iconSize,
              height: iconSize,
              left,
              top: "50%",
              transform: "translateY(-50%)",
              backgroundColor: color,
              zIndex: index + 1,
            }}
          >
            <Icon className="h-3 w-3 text-white" />
          </div>
        );
      })}
    </div>
  );
}
