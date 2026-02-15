/**
 * Phase 12C: Universal Icon Picker
 * Search, AI recommended, recent icons, categories, preview.
 */

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getAssetIcon } from "@/lib/icon-resolver";
import { useIconLibraryQuery } from "@/hooks/useIconLibraryQuery";
import { Search, Sparkles } from "lucide-react";

const CATEGORIES: { id: string; label: string; icons: string[] }[] = [
  { id: "safety", label: "Safety", icons: ["fire-extinguisher", "shield", "alert-triangle", "alarm-smoke"] },
  { id: "tools", label: "Tools", icons: ["wrench", "hammer", "settings", "cog"] },
  { id: "plumbing", label: "Plumbing", icons: ["droplet", "shower-head", "bath", "waves"] },
  { id: "hvac", label: "HVAC", icons: ["fan", "flame", "thermometer", "air-vent"] },
  { id: "electrical", label: "Electrical", icons: ["zap", "plug", "cable", "lightbulb"] },
  { id: "documents", label: "Documents", icons: ["file-text", "clipboard-check", "file-check", "search"] },
  { id: "general", label: "General", icons: ["package", "box", "home", "building"] },
];

const RECENT_STORAGE_KEY = "filla-recent-icons";
const MAX_RECENT = 8;

function getRecentIcons(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addRecentIcon(icon: string) {
  const recent = getRecentIcons().filter((i) => i !== icon);
  recent.unshift(icon);
  localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

interface UniversalIconPickerProps {
  value?: string;
  onChange: (iconName: string) => void;
  suggestedIcon?: string | null;
  suggestedConfidence?: number;
  onApplySuggested?: () => void;
  className?: string;
}

export function UniversalIconPicker({
  value,
  onChange,
  suggestedIcon,
  suggestedConfidence,
  onApplySuggested,
  className,
}: UniversalIconPickerProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = search.trim();
  const { data: searchResults, isLoading } = useIconLibraryQuery(debouncedSearch, {
    enabled: debouncedSearch.length >= 2,
  });
  const [recent, setRecent] = useState<string[]>(getRecentIcons);

  const handleSelect = useCallback(
    (iconName: string) => {
      onChange(iconName);
      addRecentIcon(iconName);
      setRecent(getRecentIcons());
    },
    [onChange]
  );

  const recentIcons = recent.filter(Boolean);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search icons..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {suggestedIcon && (
        <div className="rounded-lg bg-primary/5 p-3 border border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">AI suggests: {suggestedIcon}</span>
            {suggestedConfidence != null && (
              <span className="text-xs text-muted-foreground">({Math.round(suggestedConfidence * 100)}%)</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                handleSelect(suggestedIcon);
                onApplySuggested?.();
              }}
              className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => handleSelect(suggestedIcon)}
              className="flex items-center justify-center w-10 h-10 rounded-md border border-border hover:border-primary"
            >
              {(() => {
                const Icon = getAssetIcon(suggestedIcon);
                return <Icon className="h-5 w-5" />;
              })()}
            </button>
          </div>
        </div>
      )}

      {debouncedSearch.length >= 2 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Search results</p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Searching...</p>
          ) : searchResults && searchResults.length > 0 ? (
            <div className="grid grid-cols-6 gap-2">
              {searchResults.map((row) => {
                const Icon = getAssetIcon(row.name);
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => handleSelect(row.name)}
                    className={cn(
                      "w-10 h-10 rounded-[5px] flex items-center justify-center transition-all",
                      "border border-border hover:border-primary",
                      value === row.name ? "bg-primary text-primary-foreground border-primary" : "bg-white text-muted-foreground"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No icons found</p>
          )}
        </div>
      )}

      {recentIcons.length > 0 && debouncedSearch.length < 2 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Recent</p>
          <div className="grid grid-cols-6 gap-2">
            {recentIcons.map((name) => {
              const Icon = getAssetIcon(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleSelect(name)}
                  className={cn(
                    "w-10 h-10 rounded-[5px] flex items-center justify-center transition-all",
                    "border border-border hover:border-primary",
                    value === name ? "bg-primary text-primary-foreground border-primary" : "bg-white text-muted-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {debouncedSearch.length < 2 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Categories</p>
          <div className="space-y-3">
            {CATEGORIES.map((cat) => (
              <div key={cat.id}>
                <p className="text-xs text-muted-foreground mb-1">{cat.label}</p>
                <div className="grid grid-cols-6 gap-2">
                  {cat.icons.map((name) => {
                    const Icon = getAssetIcon(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => handleSelect(name)}
                        className={cn(
                          "w-10 h-10 rounded-[5px] flex items-center justify-center transition-all",
                          "border border-border hover:border-primary",
                          value === name ? "bg-primary text-primary-foreground border-primary" : "bg-white text-muted-foreground"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {value && (
        <div className="pt-2 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2">Preview</p>
          <div className="flex gap-4 items-center">
            {[16, 24, 32].map((size) => {
              const Icon = getAssetIcon(value);
              return (
                <div key={size} className="flex flex-col items-center gap-1">
                  <Icon className={cn("text-muted-foreground")} style={{ width: size, height: size }} />
                  <span className="text-xs text-muted-foreground">{size}px</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
