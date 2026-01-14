import { Tag } from "lucide-react";
import { Chip, ChipProps, ChipRole } from "@/components/chips/Chip";

export interface SmartChipProps extends Omit<ChipProps, 'icon' | 'color' | 'role'> {
  type?: 'space' | 'person' | 'team' | 'priority' | 'theme' | 'category' | 'compliance' | 'date';
  themeType?: 'category' | 'project' | 'tag' | 'group'; // For theme chips
  role?: ChipRole; // Override default role inference
}

/**
 * SmartChip - Enhanced chip component with type-based styling
 * Automatically applies appropriate icons and colors based on type
 * Now wraps the unified Chip component
 */
export function SmartChip({
  type,
  themeType,
  role,
  ...props
}: SmartChipProps) {
  // Default icon and color based on type
  let icon: React.ReactNode | undefined;
  let color: string | undefined;
  let inferredRole: ChipRole = role || 'fact'; // Default to fact

  switch (type) {
    case 'theme':
      icon = <Tag className="h-3 w-3" />;
      // Themes don't get color in fact chips (only filters can be colorful)
      break;
    case 'space':
      // Will use MapPin icon if provided
      break;
    case 'person':
      // Will use User icon if provided
      break;
    case 'team':
      // Will use Users icon if provided
      break;
    case 'priority':
      // Priority is a fact, not status (status is for alerts)
      inferredRole = role || 'fact';
      break;
    default:
      break;
  }

  // Color is only allowed for filter and status roles
  if (inferredRole === 'filter' && type === 'theme' && themeType === 'project') {
    color = '#FCD34D'; // Yellow for projects in filter context
  }

  return (
    <Chip
      {...props}
      role={inferredRole}
      icon={props.icon || icon}
      color={inferredRole === 'filter' ? (props.color || color) : undefined}
      label={typeof props.label === 'string' ? props.label.toUpperCase() : props.label}
    />
  );
}

