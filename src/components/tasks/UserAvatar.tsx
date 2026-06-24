import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** Standard assignee / profile avatar — matches header account menu (h-8 w-8). */
export const APP_USER_AVATAR_SIZE = 32;

interface UserAvatarProps {
  imageUrl?: string | null;
  name?: string;
  propertyColor?: string;
  size?: number;
  /** Square chips (default) or circular profile frame. */
  shape?: "square" | "circle";
  className?: string;
}

/**
 * UserAvatar - Shows user avatar with initials fallback
 * When no image, shows initials on property color background
 */
export function UserAvatar({ 
  imageUrl, 
  name = "", 
  propertyColor = "#8EC9CE",
  size = 24,
  shape = "square",
  className 
}: UserAvatarProps) {
  // Extract initials from name
  const getInitials = (name: string): string => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const initials = getInitials(name);
  const rootRadiusClass = shape === "circle" ? "rounded-[8px]" : "rounded-[5px]";
  const fallbackRadiusClass = "rounded-[5px]";

  return (
    <Avatar 
      className={cn(
        rootRadiusClass,
        shape !== "circle" && "border-2 border-background",
        className
      )}
      style={{ width: size, height: size }}
    >
      {imageUrl && (
        <AvatarImage src={imageUrl} alt={name} className="object-cover" />
      )}
      <AvatarFallback
        className={cn(fallbackRadiusClass, "text-white font-medium text-xs")}
        style={{ 
          backgroundColor: propertyColor,
          fontSize: `${size * 0.4}px`
        }}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}

interface OverlappingAvatarsProps {
  users: Array<{
    imageUrl?: string | null;
    name?: string;
    propertyColor?: string;
  }>;
  size?: number;
  overlap?: number; // Percentage overlap (0-100)
  maxVisible?: number;
  shape?: "square" | "circle";
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
  shape = "square",
  className 
}: OverlappingAvatarsProps) {
  if (users.length === 0) return null;
  
  const visibleUsers = users.slice(0, maxVisible);
  const remainingCount = users.length - maxVisible;
  const overlapPx = (size * overlap) / 100;
  const radiusClass = shape === "circle" ? "rounded-[8px]" : "rounded-[5px]";

  return (
    <div className={cn("flex items-center", className)} style={{ marginLeft: `-${overlapPx}px` }}>
      {visibleUsers.map((user, index) => (
        <div
          key={index}
          style={{
            marginLeft: index > 0 ? `-${overlapPx}px` : 0,
            zIndex: visibleUsers.length - index,
          }}
        >
          <UserAvatar
            imageUrl={user.imageUrl}
            name={user.name}
            propertyColor={user.propertyColor}
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
            fontSize: `${size * 0.4}px` 
          }}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
}

