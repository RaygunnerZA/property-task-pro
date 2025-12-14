import { cn } from "@/lib/utils";
import { 
  Home, Building, Wrench, ShowerHead, 
  Bath, CookingPot, Bed, Car,
  Package, Plug, Lightbulb, Flame,
  Settings, Sparkles, ClipboardList, Target
} from "lucide-react";

const ICONS = [
  { name: "home", icon: Home },
  { name: "building", icon: Building },
  { name: "wrench", icon: Wrench },
  { name: "shower", icon: ShowerHead },
  { name: "bath", icon: Bath },
  { name: "cooking", icon: CookingPot },
  { name: "bed", icon: Bed },
  { name: "car", icon: Car },
  { name: "package", icon: Package },
  { name: "plug", icon: Plug },
  { name: "lightbulb", icon: Lightbulb },
  { name: "flame", icon: Flame },
  { name: "settings", icon: Settings },
  { name: "sparkles", icon: Sparkles },
  { name: "clipboard", icon: ClipboardList },
  { name: "target", icon: Target },
];

interface IconPickerProps {
  value?: string;
  onChange: (iconName: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {ICONS.map(({ name, icon: Icon }) => (
        <button
          key={name}
          type="button"
          onClick={() => onChange(name)}
          className={cn(
            "w-10 h-10 rounded-[5px] flex items-center justify-center transition-all",
            "border border-border hover:border-primary",
            value === name
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-white text-muted-foreground"
          )}
        >
          <Icon className="h-5 w-5" />
        </button>
      ))}
    </div>
  );
}

// Helper to render icon by name
export function getIconByName(name: string): React.ReactNode {
  const found = ICONS.find(i => i.name === name);
  if (found) {
    const Icon = found.icon;
    return <Icon className="h-4 w-4" />;
  }
  return null;
}
