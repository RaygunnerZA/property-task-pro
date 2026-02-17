/**
 * AIIconColorPicker — Simplified icon + color picker for Add Space/Asset/Property modals.
 * - 5 icon slots: thematic defaults on load; when user types, AI replaces first slot if relevant
 * - 5 color options
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";
import { getAssetIcon } from "@/lib/icon-resolver";
import { cn } from "@/lib/utils";

const DEFAULT_FALLBACK = ["box", "home", "building", "package", "tag"];

const COLORS_5 = [
  "#8EC9CE", // Teal (primary)
  "#FF6B6B", // Coral
  "#4ECDC4", // Mint
  "#45B7D1", // Sky Blue
  "#96CEB4", // Sage
];

interface AIIconColorPickerProps {
  /** Search text (e.g. space name, asset name, property nickname) — AI uses this to suggest icons */
  searchText: string;
  value: { iconName: string; color: string };
  onChange: (iconName: string, color: string) => void;
  /** 5 thematic icons shown initially (e.g. buildings for property, rooms for spaces). When user types, AI replaces first if relevant. */
  defaultIcons?: string[];
  /** Entity type for fallback when AI returns nothing */
  fallbackSearch?: string;
  /** When provided (e.g. from space_types lookup), takes precedence over ai_icon_search */
  suggestedIcon?: string | null;
  disabled?: boolean;
  className?: string;
}

export function AIIconColorPicker({
  searchText,
  value,
  onChange,
  defaultIcons = DEFAULT_FALLBACK,
  fallbackSearch = "room",
  suggestedIcon,
  disabled = false,
  className,
}: AIIconColorPickerProps) {
  const [aiIcons, setAiIcons] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedSearch = useDebounce(searchText.trim(), 400);

  const themeIcons = defaultIcons.slice(0, 5);
  // When suggestedIcon provided: use it as primary (from space_types); else AI results or thematic defaults
  const displayIcons =
    suggestedIcon
      ? [suggestedIcon, ...themeIcons.filter((t) => t !== suggestedIcon)].slice(0, 5)
      : aiIcons.length > 0
        ? aiIcons
        : themeIcons;

  useEffect(() => {
    if (suggestedIcon) {
      setAiIcons([]);
      setLoading(false);
      if (!value.iconName || value.iconName !== suggestedIcon) {
        onChange(suggestedIcon, value.color);
      }
      return;
    }
    if (!debouncedSearch) {
      setAiIcons([]);
      setLoading(false);
      if (!value.iconName || !themeIcons.includes(value.iconName)) {
        onChange(themeIcons[0], value.color);
      }
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .rpc("ai_icon_search", { query_text: debouncedSearch })
      .then(({ data }) => {
        if (cancelled) return;
        const names = (data ?? [])
          .slice(0, 5)
          .map((r: { name?: string }) => r?.name)
          .filter(Boolean) as string[];
        if (names.length > 0) {
          setAiIcons(names);
          if (!value.iconName || !names.includes(value.iconName)) {
            onChange(names[0], value.color);
          }
        } else {
          setAiIcons([]);
          if (!value.iconName || !themeIcons.includes(value.iconName)) {
            onChange(themeIcons[0], value.color);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setAiIcons([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, suggestedIcon]);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Icon row: 5 thematic slots; first replaced by AI when user types */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">
          {debouncedSearch ? "Choose an icon" : "Choose an icon (or type a name for suggestions)"}
        </p>
        <div className="flex gap-2 justify-center flex-wrap">
          {displayIcons.map((name, i) => {
            const IconComponent = getAssetIcon(name);
            const isSelected = value.iconName === name;
            return (
              <button
                key={`${name}-${i}`}
                type="button"
                disabled={disabled || loading}
                onClick={() => onChange(name, value.color)}
                className={cn(
                  "w-10 h-10 rounded-[8px] flex items-center justify-center transition-all",
                  "border-2 border-border",
                  isSelected
                    ? "border-primary bg-primary/10 shadow-md"
                    : "bg-muted/30 hover:bg-muted/50"
                )}
              >
                <IconComponent
                  className={cn("h-5 w-5", isSelected ? "text-primary" : "text-muted-foreground")}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Color row: 5 options */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Choose a color</p>
        <div className="flex gap-2 justify-center flex-wrap">
          {COLORS_5.map((color) => (
            <button
              key={color}
              type="button"
              disabled={disabled}
              onClick={() => onChange(value.iconName || displayIcons[0], color)}
              className={cn(
                "w-10 h-10 rounded-full transition-all",
                value.color === color && "scale-125 ring-2 ring-offset-2 ring-foreground/30"
              )}
              style={{
                backgroundColor: color,
                boxShadow: "2px 2px 4px rgba(0,0,0,0.1), -1px -1px 2px rgba(255,255,255,0.3)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export { COLORS_5 };
