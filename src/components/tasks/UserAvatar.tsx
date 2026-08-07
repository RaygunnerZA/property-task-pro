import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** Standard assignee / profile avatar — matches header account menu (h-8 w-8). */
export const APP_USER_AVATAR_SIZE = 32;

/** Task card property icon chips — match META_CHIP_AVATAR_SIZE (28×28). */
export const TASK_CARD_META_CHIP_SIZE = 28;

/** Task card assigner / assignee — matches TaskStatusMark (22×22). */
export const TASK_CARD_AVATAR_SIZE = 22;

interface UserAvatarProps {
  imageUrl?: string | null;
  name?: string;
  /** Fallback fill when no photo (or initials color for statusMark). */
  propertyColor?: string;
  size?: number;
  /**
   * `card` — same radius as property icon chips (`rounded-card`).
   * `circle` / `square` — legacy shapes.
   * `statusMark` — same size/radius/deboss as task status box; initials in user color.
   */
  shape?: "square" | "circle" | "card" | "statusMark";
  /** Force initials — never show photo. */
  initialsOnly?: boolean;
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
  initialsOnly = false,
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
  const showImage = !initialsOnly && !!imageUrl;

  if (shape === "statusMark") {
    const dim = TASK_CARD_AVATAR_SIZE;
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-[5px]",
          "bg-background",
          "shadow-[1px_2px_2px_0px_rgba(0,0,0,0.12),-1px_-1px_2px_0px_rgba(255,255,255,0.85)]",
          className
        )}
        style={{ width: dim, height: dim, minWidth: dim, minHeight: dim }}
        title={name || undefined}
        aria-label={name || "Assignee"}
      >
        <span
          className="font-bold leading-none select-none"
          style={{
            color: propertyColor,
            // ~1pt larger than prior 0.38×22 (~8.4px → ~9.7px)
            fontSize: `${dim * 0.44}px`,
          }}
        >
          {initials}
        </span>
      </span>
    );
  }

  const radiusClass =
    shape === "square" ? "rounded-sharp" : shape === "circle" ? "rounded-full" : "rounded-card";

  return (
    <Avatar
      className={cn(radiusClass, shape === "square" && "border-2 border-background", className)}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
    >
      {showImage && <AvatarImage src={imageUrl!} alt={name} className={cn("object-cover", radiusClass)} />}
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
