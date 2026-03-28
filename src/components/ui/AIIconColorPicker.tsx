/**
 * AIIconColorPicker — Simplified icon + color picker for Add Space/Asset/Property modals.
 * - 5 icon slots: thematic defaults on load; when user types, AI replaces first slot if relevant
 * - 5 color options
 */
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "@/hooks/useDebounce";
import { getAssetIcon } from "@/lib/icon-resolver";
import {
  PROPERTY_COLOR_PALETTE,
  normalizePropertyColorHex,
  normalizePropertyIconKey,
  firstFreeIconFromList,
} from "@/lib/propertyVisualUniqueness";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { RefreshCw, Search } from "lucide-react";

const DEFAULT_FALLBACK = ["box", "home", "building", "package", "tag"];

/** @deprecated Use PROPERTY_COLOR_PALETTE from @/lib/propertyVisualUniqueness */
const COLORS_6 = [...PROPERTY_COLOR_PALETTE];

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
  /** When true, show an editable search field to find thematically appropriate icons */
  showSearchInput?: boolean;
  disabled?: boolean;
  className?: string;
  /** Property flow only: icon keys already used by other properties in the org */
  takenPropertyIconNames?: string[];
  /** Property flow only: normalized hex (no #, lowercase) already used by other properties */
  takenPropertyColorHexes?: string[];
}

export function AIIconColorPicker({
  searchText,
  value,
  onChange,
  defaultIcons = DEFAULT_FALLBACK,
  fallbackSearch = "room",
  suggestedIcon,
  showSearchInput = false,
  disabled = false,
  className,
  takenPropertyIconNames,
  takenPropertyColorHexes,
}: AIIconColorPickerProps) {
  const [aiIcons, setAiIcons] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [localSearchText, setLocalSearchText] = useState(searchText);
  useEffect(() => {
    setLocalSearchText(searchText);
  }, [searchText]);
  const effectiveSearchText = showSearchInput ? localSearchText : searchText;
  const debouncedSearch = useDebounce(effectiveSearchText.trim(), 400);

  const iconTakenSet = useMemo(
    () => new Set((takenPropertyIconNames ?? []).map((k) => normalizePropertyIconKey(k))),
    [takenPropertyIconNames]
  );
  const colorTakenSet = useMemo(
    () => new Set(takenPropertyColorHexes ?? []),
    [takenPropertyColorHexes]
  );

  const themeIcons = defaultIcons.slice(0, 5);

  const rawDisplayIcons =
    aiIcons.length > 0
      ? aiIcons
      : suggestedIcon
        ? [suggestedIcon, ...themeIcons.filter((t) => t !== suggestedIcon)].slice(0, 5)
        : themeIcons;

  const displayIcons = useMemo(() => {
    if (iconTakenSet.size === 0) return rawDisplayIcons.slice(0, 5);
    const currentKey = normalizePropertyIconKey(value.iconName);
    const pool = [...rawDisplayIcons];
    if (value.iconName && !pool.includes(value.iconName)) pool.unshift(value.iconName);
    const deduped = [...new Set(pool)];
    const available = deduped.filter(
      (n) =>
        !iconTakenSet.has(normalizePropertyIconKey(n)) ||
        normalizePropertyIconKey(n) === currentKey
    );
    const out = [...available];
    const pad = [...themeIcons, ...DEFAULT_FALLBACK];
    for (const p of pad) {
      if (out.length >= 5) break;
      if (
        !iconTakenSet.has(normalizePropertyIconKey(p)) &&
        !out.some((x) => normalizePropertyIconKey(x) === normalizePropertyIconKey(p))
      ) {
        out.push(p);
      }
    }
    return out.slice(0, 5);
  }, [rawDisplayIcons, themeIcons, iconTakenSet, value.iconName]);

  const visibleColors = useMemo(() => {
    const current = normalizePropertyColorHex(value.color);
    return PROPERTY_COLOR_PALETTE.filter(
      (c) => !colorTakenSet.has(normalizePropertyColorHex(c)) || normalizePropertyColorHex(c) === current
    );
  }, [colorTakenSet, value.color]);

  const takenIconsDep = (takenPropertyIconNames ?? []).slice().sort().join("|");

  useEffect(() => {
    const pickDefaultIcon = () =>
      firstFreeIconFromList(themeIcons, iconTakenSet) ??
      firstFreeIconFromList([...DEFAULT_FALLBACK], iconTakenSet) ??
      themeIcons[0];

    const pickFromAi = (names: string[]) =>
      firstFreeIconFromList(names, iconTakenSet) ??
      pickDefaultIcon() ??
      names[0];

    const shouldAiSearch = !!debouncedSearch || refreshKey > 0;

    if (!shouldAiSearch) {
      setAiIcons([]);
      setLoading(false);
      if (suggestedIcon) {
        const sKey = normalizePropertyIconKey(suggestedIcon);
        const suggestedOk = !iconTakenSet.has(sKey);
        if (suggestedOk && (!value.iconName || value.iconName !== suggestedIcon)) {
          onChange(suggestedIcon, value.color);
        } else if (
          !value.iconName ||
          iconTakenSet.has(normalizePropertyIconKey(value.iconName))
        ) {
          const d = pickDefaultIcon();
          if (d) onChange(d, value.color);
        }
      } else if (
        !value.iconName ||
        !themeIcons.includes(value.iconName) ||
        iconTakenSet.has(normalizePropertyIconKey(value.iconName))
      ) {
        const d = pickDefaultIcon();
        if (d) onChange(d, value.color);
      }
      return;
    }

    const query = debouncedSearch || effectiveSearchText.trim() || fallbackSearch;
    if (!query) return;

    let cancelled = false;
    setLoading(true);
    supabase
      .rpc("ai_icon_search", { query_text: query })
      .then(({ data }) => {
        if (cancelled) return;
        const names = (data ?? [])
          .slice(0, 5)
          .map((r: { name?: string }) => r?.name)
          .filter(Boolean) as string[];
        if (names.length > 0) {
          setAiIcons(names);
          const next = pickFromAi(names);
          const keepCurrent =
            value.iconName &&
            names.some(
              (n) => normalizePropertyIconKey(n) === normalizePropertyIconKey(value.iconName)
            ) &&
            !iconTakenSet.has(normalizePropertyIconKey(value.iconName));
          if (!keepCurrent) {
            onChange(next, value.color);
          }
        } else {
          setAiIcons([]);
          if (
            !value.iconName ||
            !themeIcons.includes(value.iconName) ||
            iconTakenSet.has(normalizePropertyIconKey(value.iconName))
          ) {
            const d = pickDefaultIcon();
            if (d) onChange(d, value.color);
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
    // onChange omitted: parent often passes an inline callback; including it would re-run every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    debouncedSearch,
    suggestedIcon,
    refreshKey,
    fallbackSearch,
    effectiveSearchText,
    themeIcons,
    takenIconsDep,
    iconTakenSet,
    value.iconName,
    value.color,
  ]);

  return (
    <div className={cn("space-y-4", className)}>
      {showSearchInput && (
        <div>
          <label htmlFor="icon-search" className="text-xs font-medium text-muted-foreground mb-2 block">
            Search for thematic ideas
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              id="icon-search"
              value={localSearchText}
              onChange={(e) => setLocalSearchText(e.target.value)}
              placeholder="e.g. stairs, steps, entrance..."
              className="pl-8 h-9 text-sm shadow-sm"
            />
          </div>
        </div>
      )}
      {/* Icon row: 5 thematic slots; first replaced by AI when user types */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">
          {debouncedSearch ? "Choose an icon" : "Choose an icon (or type a name for suggestions)"}
        </p>
        <div className="flex gap-2 justify-center flex-wrap">
          {displayIcons.map((name, i) => {
            const IconComponent = getAssetIcon(name);
            const isSelected =
              normalizePropertyIconKey(value.iconName) === normalizePropertyIconKey(name);
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
          <button
            type="button"
            disabled={disabled || loading}
            onClick={() => setRefreshKey((k) => k + 1)}
            className={cn(
              "w-10 h-10 rounded-[8px] flex items-center justify-center transition-all",
              "border-2 border-border bg-white hover:bg-muted/20",
              loading && "animate-spin"
            )}
            title="Refresh suggestions"
          >
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Color row */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">Choose a color</p>
        {visibleColors.length === 0 ? (
          <p className="text-xs text-center text-muted-foreground">
            All palette colours are in use in this organisation.
          </p>
        ) : (
          <div className="flex gap-2 justify-center flex-wrap">
            {visibleColors.map((color) => (
              <button
                key={color}
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange(value.iconName || displayIcons[0] || themeIcons[0], color)
                }
                className={cn(
                  "w-10 h-10 rounded-full transition-all",
                  normalizePropertyColorHex(value.color) === normalizePropertyColorHex(color) &&
                    "scale-125 ring-2 ring-offset-2 ring-foreground/30"
                )}
                style={{
                  backgroundColor: color,
                  boxShadow: "2px 2px 4px rgba(0,0,0,0.1), -1px -1px 2px rgba(255,255,255,0.3)",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export { COLORS_6 };
