import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** Standard assignee / profile avatar — matches header account menu (h-8 w-8). */
export const APP_USER_AVATAR_SIZE = 32;

/** Task card / detail meta chips — match PropertyIconChip & META_CHIP_AVATAR_SIZE (28×28). */
export const TASK_CARD_META_CHIP_SIZE = 28;

interface UserAvatarProps {
  imageUrl?: string | null;
  name?: string;
  /** Fallback fill when no photo. */
  propertyColor?: string;
  size?: number;
  /**
   * `card` — same radius as property icon chips (`rounded-card`).
   * `circle` / `square` — legacy shapes.
   */
  shape?: "square" | "circle" | "card";
  className?: string;
}

/**
 * UserAvatar - Shows user avatar with initials fallback
 * When no image, shows initials on accent color background
 */
export function UserAvatar({
  imageUrl,
  name = "",
  propertyColor = "#8EC9CE",
  size = 24,
  shape = "card",
  className,
}: UserAvatarProps) {
  const getInitials = (value: string): string => {
    if (!value) return "?";
    const parts = value.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return value.substring(0, 2).toUpperCase();
  };

  const initials = getInitials(name);
  const radiusClass =
    shape === "square" ? "rounded-sharp" : shape === "circle" ? "rounded-full" : "rounded-card";

  return (
    <Avatar
      className={cn(radiusClass, shape === "square" && "border-2 border-background", className)}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
    >
      {imageUrl && <AvatarImage src={imageUrl} alt={name} className={cn("object-cover", radiusClass)} />}
      <AvatarFallback
        className={cn(radiusClass, "text-white font-medium text-xs")}
        style={{
          backgroundColor: propertyColor,
          fontSize: `${size * 0.4}px`,
        }}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

interface OverlappingAvatarsProps {
  users: Array<{
    id?: string;
    imageUrl?: string | null;
    name?: string;
    propertyColor?: string;
    accentColor?: string;
  }>;
  size?: number;
  overlap?: number;
  maxVisible?: number;
  shape?: "square" | "circle" | "card";
  className?: string;
}

/**
 * OverlappingAvatars - Shows multiple user avatars with overlap
 * Default 20% overlap between avatars
 */
export function OverlappingAvatars({
  users,
  size = 24,
  overlap = 20,
  maxVisible = 3,
  shape = "card",
  className,
}: OverlappingAvatarsProps) {
  if (users.length === 0) return null;

  const visibleUsers = users.slice(0, maxVisible);
  const remainingCount = users.length - maxVisible;
  const overlapPx = (size * overlap) / 100;
  const radiusClass =
    shape === "square" ? "rounded-sharp" : shape === "circle" ? "rounded-full" : "rounded-card";

  return (
    <div className={cn("flex items-center", className)}>
      {visibleUsers.map((user, index) => (
        <div
          key={user.id ?? `${user.name ?? "user"}-${index}`}
          style={{
            marginLeft: index > 0 ? `-${overlapPx}px` : 0,
            zIndex: visibleUsers.length - index,
          }}
        >
          <UserAvatar
            imageUrl={user.imageUrl}
            name={user.name}
            propertyColor={user.accentColor || user.propertyColor}
            size={size}
            shape={shape}
          />
        </div>
      ))}
      {remainingCount > 0 && (
        <div
          className={cn(
            "flex items-center justify-center border-2 border-background bg-muted text-muted-foreground text-xs font-medium",
            radiusClass
          )}
          style={{
            marginLeft: `-${overlapPx}px`,
            zIndex: 0,
            width: size,
            height: size,
            fontSize: `${size * 0.4}px`,
          }}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}
