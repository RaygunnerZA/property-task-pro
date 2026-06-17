import { getPropertyChipIcon } from "@/lib/propertyChipIcons";
import type { PropertySelectorRowProperty } from "@/components/properties/PropertySelectorRow";
import { cn } from "@/lib/utils";

type PropertySelectorAllThumbnailProps = {
  properties: PropertySelectorRowProperty[];
  /** `header` = compact strip for collapsed selector; `row` = list row thumbnail. */
  size?: "header" | "row";
  className?: string;
};

const SIZES = {
  header: { width: 44, height: 32, icon: 16 },
  row: { width: 56, height: 72, icon: 22 },
} as const;

/** Stacks property chip icons, evenly offset across the thumbnail width. */
export function PropertySelectorAllThumbnail({
  properties,
  size = "row",
  className,
}: PropertySelectorAllThumbnailProps) {
  const { width, height, icon: iconSize } = SIZES[size];
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
            <Icon
              className={cn(
                size === "header" ? "h-2.5 w-2.5" : "h-3 w-3",
                "text-white"
              )}
            />
          </div>
        );
      })}
    </div>
  );
}
