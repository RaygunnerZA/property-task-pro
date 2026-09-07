import { getPropertyChipIcon } from "@/lib/propertyChipIcons";
import { cn } from "@/lib/utils";

type PropertyAvatarChipProps = {
  name: string;
  thumbnailUrl?: string | null;
  iconName?: string | null;
  iconColorHex?: string | null;
  className?: string;
  size?: "sm" | "md";
};

/** Compact property identity — thumbnail or icon chip. */
export function PropertyAvatarChip({
  name,
  thumbnailUrl,
  iconName,
  iconColorHex,
  className,
  size = "sm",
}: PropertyAvatarChipProps) {
  const Icon = getPropertyChipIcon(iconName || "home");
  const color = iconColorHex?.trim() || "#8EC9CE";
  const dim = size === "sm" ? "h-6 w-6" : "h-8 w-8";

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-lg bg-card/80 py-0.5 pl-0.5 pr-2 shadow-e1",
        className
      )}
      title={name}
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt=""
          className={cn(dim, "shrink-0 rounded-md object-cover")}
        />
      ) : (
        <span
          className={cn(
            dim,
            "inline-flex shrink-0 items-center justify-center rounded-md text-white"
          )}
          style={{ backgroundColor: color }}
        >
          <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />
        </span>
      )}
      <span className="truncate text-xs font-medium text-foreground">{name}</span>
    </span>
  );
}
