import { Tag } from "lucide-react";
import { StandardChip, StandardChipProps } from "@/components/chips/StandardChip";

export interface SmartChipProps extends Omit<StandardChipProps, 'icon' | 'color'> {
  type?: 'space' | 'person' | 'team' | 'priority' | 'theme' | 'category' | 'compliance' | 'date';
  themeType?: 'category' | 'project' | 'tag' | 'group'; // For theme chips
}

/**
 * SmartChip - Enhanced chip component with type-based styling
 * Automatically applies appropriate icons and colors based on type
 */
export function SmartChip({
  type,
  themeType,
  ...props
}: SmartChipProps) {
  // Default icon and color based on type
  let icon: React.ReactNode | undefined;
  let color: string | undefined;

  switch (type) {
    case 'theme':
      icon = <Tag className="h-3 w-3" />;
      color = '#FCD34D'; // Yellow for themes
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
      // Will use AlertTriangle icon if provided
      break;
    default:
      break;
  }

  // Override with theme-specific color if it's a project theme
  if (type === 'theme' && themeType === 'project') {
    color = '#FCD34D'; // Yellow for projects
  }

  return (
    <StandardChip
      {...props}
      icon={props.icon || icon}
      color={props.color || color}
    />
  );
}

