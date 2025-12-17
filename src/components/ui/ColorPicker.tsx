import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

// Muted colors that work well with white text
const COLORS = [
  // Row 1
  { name: "teal", hex: "#3D8B8B" },
  { name: "coral", hex: "#CD6B6B" },
  { name: "slate", hex: "#5A6A7A" },
  { name: "olive", hex: "#6B7B3D" },
  // Row 2
  { name: "plum", hex: "#7B5A7A" },
  { name: "steel", hex: "#4A6A8A" },
  { name: "terracotta", hex: "#B67A5A" },
  { name: "sage", hex: "#6B8B6B" },
  // Row 3
  { name: "navy", hex: "#3A4A6A" },
  { name: "rose", hex: "#9A5A6A" },
  { name: "amber", hex: "#9A7A3A" },
  { name: "moss", hex: "#5A6A4A" },
  // Row 4
  { name: "indigo", hex: "#5A5A8A" },
  { name: "peach", hex: "#BA7A6A" },
  { name: "charcoal", hex: "#4A4A4A" },
  { name: "mint", hex: "#4A8A7A" },
];

interface ColorPickerProps {
  value?: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {COLORS.map(({ name, hex }) => (
        <button
          key={name}
          type="button"
          onClick={() => onChange(hex)}
          style={{ backgroundColor: hex }}
          className={cn(
            "w-10 h-10 rounded-[5px] flex items-center justify-center transition-all",
            "border-2 hover:scale-105",
            value === hex
              ? "border-foreground shadow-md"
              : "border-transparent"
          )}
        >
          {value === hex && (
            <Check className="h-5 w-5 text-white" />
          )}
        </button>
      ))}
    </div>
  );
}

export { COLORS };
