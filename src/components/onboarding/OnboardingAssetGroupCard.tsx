import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { SemanticChip, ExpandableAssetChip } from "@/components/chips/semantic";
import { Plus } from "lucide-react";
import type {
  AssetGroup,
  AssetSuggestionLabelOverrides,
  GroupExtraAsset,
} from "./onboardingAssetGroups";
import { SpaceGroupCardBanner } from "@/components/spaces/SpaceGroupCardBanner";
import { getAssetGroupCardIllustration } from "@/lib/assetGroupIllustrations";
import {
  SPACE_GROUP_ADD_INPUT_CLASS,
  SPACE_GROUP_ADD_INPUT_SHADOW,
} from "./spaceGroupCardInputStyles";

const HOVER_EXPAND_DELAY_MS = 450;
const EXPAND_DURATION_MS = 350;
const COLLAPSE_DURATION_MS = 450;
const SELECTED_CHIP_TEAL = "hsl(var(--primary-deep))";

const DASHED_LINE_STYLE = {
  height: "1px",
  backgroundImage:
    "repeating-linear-gradient(to right, hsl(var(--border)) 0px, hsl(var(--border)) 4px, transparent 4px, transparent 7px)",
  backgroundSize: "7px 1px",
  backgroundRepeat: "repeat-x" as const,
};

interface OnboardingAssetGroupCardProps {
  group: AssetGroup;
  selectedAssetsSet: Set<string>;
  extraAssets?: GroupExtraAsset[];
  selectedAssetsNewestFirst?: string[];
  assetFilter?: string;
  suggestionLabelOverrides?: AssetSuggestionLabelOverrides;
  onAddAsset: (name: string, extra?: boolean) => void;
  onRemoveAsset?: (name: string) => void;
  onRenameAsset?: (name: string, groupId: string) => void;
  onViewAsset?: (name: string, groupId: string) => void;
  viewAssetByNameKey?: Record<string, () => void>;
  onCopyAsset?: (name: string, groupId: string) => void;
  className?: string;
}

const BANNER_HEIGHT_PX = 130;
const BANNER_COLLAPSED_HEIGHT_PX = 70;

export function OnboardingAssetGroupCard({
  group,
  selectedAssetsSet,
  extraAssets = [],
  selectedAssetsNewestFirst,
  assetFilter = "",
  suggestionLabelOverrides = {},
  onAddAsset,
  onRemoveAsset,
  onRenameAsset,
  onViewAsset,
  viewAssetByNameKey = {},
  onCopyAsset,
  className,
}: OnboardingAssetGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [transitionMs, setTransitionMs] = useState(EXPAND_DURATION_MS);
  const [customAssetName, setCustomAssetName] = useState("");
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const enterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressHoverExpandRef = useRef(false);
  const chipsScrollRef = useRef<HTMLDivElement | null>(null);
  const prevLeadingChipRef = useRef<string | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (suppressHoverExpandRef.current) return;
    if (enterTimeoutRef.current) return;
    enterTimeoutRef.current = setTimeout(() => {
      enterTimeoutRef.current = null;
      setTransitionMs(EXPAND_DURATION_MS);
      setIsExpanded(true);
    }, HOVER_EXPAND_DELAY_MS);
  }, []);

  const handleMouseLeave = useCallback(() => {
    suppressHoverExpandRef.current = false;
    if (enterTimeoutRef.current) {
      clearTimeout(enterTimeoutRef.current);
      enterTimeoutRef.current = null;
    }
  }, []);

  const handleBannerClick = useCallback(() => {
    if (!isExpanded) return;
    if (enterTimeoutRef.current) {
      clearTimeout(enterTimeoutRef.current);
      enterTimeoutRef.current = null;
    }
    suppressHoverExpandRef.current = true;
    setTransitionMs(COLLAPSE_DURATION_MS);
    setIsExpanded(false);
  }, [isExpanded]);

  const handleChipClick = (name: string) => {
    const key = name.toLowerCase().trim();
    if (selectedAssetsSet.has(key)) return;
    onAddAsset(name);
  };

  const handleAddCustomAsset = () => {
    const trimmed = customAssetName.trim();
    if (!trimmed) return;
    onAddAsset(trimmed, true);
    setCustomAssetName("");
  };

  const handleDismissSuggestion = (sourceKey: string) => {
    setDismissedSuggestions((prev) => new Set(prev).add(sourceKey));
  };

  const resolveSuggestionSourceKey = (displayName: string): string => {
    const displayKey = displayName.toLowerCase().trim();
    for (const [sourceKey, label] of Object.entries(suggestionLabelOverrides)) {
      if (label.toLowerCase().trim() === displayKey) return sourceKey;
    }
    for (const name of group.suggestedAssets) {
      if (name.toLowerCase().trim() === displayKey) return displayKey;
    }
    return displayKey;
  };

  const visibleAssetNames = useMemo(() => {
    const filter = assetFilter.trim().toLowerCase();
    const matchesFilter = (name: string) =>
      !filter || name.toLowerCase().includes(filter);

    const suggestionSeen = new Set<string>();
    const suggestions: string[] = [];

    for (const name of group.suggestedAssets) {
      if (typeof name !== "string" || !name.trim()) continue;
      const sourceKey = name.toLowerCase().trim();
      if (dismissedSuggestions.has(sourceKey)) continue;
      const displayName = suggestionLabelOverrides[sourceKey] ?? name;
      const displayKey = displayName.toLowerCase().trim();
      if (suggestionSeen.has(displayKey)) continue;
      suggestionSeen.add(displayKey);
      suggestions.push(displayName);
    }

    const extrasNewestFirst: string[] = [];
    const extrasInsertAfter: { name: string; afterKey: string }[] = [];
    for (const extra of extraAssets) {
      const extraName =
        typeof extra === "string"
          ? extra
          : typeof extra?.name === "string"
            ? extra.name
            : null;
      if (!extraName?.trim()) continue;
      const key = extraName.toLowerCase().trim();
      const insertAfter =
        typeof extra === "object" && typeof extra?.insertAfter === "string"
          ? extra.insertAfter
          : undefined;
      if (insertAfter?.trim()) {
        extrasInsertAfter.push({
          name: extraName,
          afterKey: insertAfter.toLowerCase().trim(),
        });
        continue;
      }
      if (!suggestionSeen.has(key)) {
        extrasNewestFirst.push(extraName);
      }
    }

    const selectedSuggestions: string[] = [];
    const unselectedSuggestions: string[] = [];
    for (const displayName of suggestions) {
      const key = displayName.toLowerCase().trim();
      if (selectedAssetsSet.has(key)) selectedSuggestions.push(displayName);
      else unselectedSuggestions.push(displayName);
    }

    let selectedOrdered: string[];
    if (selectedAssetsNewestFirst && selectedAssetsNewestFirst.length > 0) {
      const seenSelected = new Set<string>();
      selectedOrdered = [];
      for (const name of selectedAssetsNewestFirst) {
        if (!name?.trim()) continue;
        const key = name.toLowerCase().trim();
        if (seenSelected.has(key)) continue;
        if (!selectedAssetsSet.has(key)) continue;
        seenSelected.add(key);
        selectedOrdered.push(name);
      }
      for (const name of extrasNewestFirst) {
        const key = name.toLowerCase().trim();
        if (seenSelected.has(key)) continue;
        seenSelected.add(key);
        selectedOrdered.push(name);
      }
      for (const name of selectedSuggestions) {
        const key = name.toLowerCase().trim();
        if (seenSelected.has(key)) continue;
        seenSelected.add(key);
        selectedOrdered.push(name);
      }
    } else {
      selectedOrdered = [...extrasNewestFirst, ...selectedSuggestions];
    }

    const selectedKeys = new Set(selectedOrdered.map((n) => n.toLowerCase().trim()));
    const names = [
      ...selectedOrdered.filter(matchesFilter),
      ...unselectedSuggestions.filter(
        (name) => !selectedKeys.has(name.toLowerCase().trim()) && matchesFilter(name)
      ),
    ];

    for (const { name, afterKey } of extrasInsertAfter) {
      if (!matchesFilter(name)) continue;
      const key = name.toLowerCase().trim();
      if (names.some((n) => n.toLowerCase().trim() === key)) continue;
      const afterIdx = names.findIndex((n) => n.toLowerCase().trim() === afterKey);
      if (afterIdx >= 0) names.splice(afterIdx + 1, 0, name);
      else names.unshift(name);
    }

    return names;
  }, [
    group.suggestedAssets,
    extraAssets,
    selectedAssetsNewestFirst,
    assetFilter,
    dismissedSuggestions,
    suggestionLabelOverrides,
    selectedAssetsSet,
  ]);

  useEffect(() => {
    const leading = visibleAssetNames[0] ?? null;
    if (leading && leading !== prevLeadingChipRef.current && isExpanded) {
      chipsScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
    prevLeadingChipRef.current = leading;
  }, [visibleAssetNames, isExpanded]);

  const transitionStyle = { transitionDuration: `${transitionMs}ms` };

  return (
    <div
      className={cn("w-[230px] h-[295px] flex-shrink-0", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative flex h-full flex-col gap-0 overflow-hidden rounded-card bg-card pb-[3px] shadow-e1">
        <div
          role={isExpanded ? "button" : undefined}
          tabIndex={isExpanded ? 0 : undefined}
          aria-label={isExpanded ? `Collapse ${group.label}` : undefined}
          onClick={isExpanded ? handleBannerClick : undefined}
          onKeyDown={
            isExpanded
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleBannerClick();
                  }
                }
              : undefined
          }
          className={cn(
            "overflow-hidden transition-all ease-out",
            isExpanded && "cursor-pointer"
          )}
          style={{
            ...transitionStyle,
            height: isExpanded ? BANNER_COLLAPSED_HEIGHT_PX : BANNER_HEIGHT_PX,
          }}
        >
          <SpaceGroupCardBanner
            imageSrc={getAssetGroupCardIllustration(group.id)}
            alt={group.label}
            color={group.color}
            className="h-full"
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-0 px-3 pb-2 pt-2">
          <div className="shrink-0 space-y-2 transition-transform ease-out" style={transitionStyle}>
            <h3 className="text-lg font-semibold leading-tight text-foreground">{group.label}</h3>
            <div className="-ml-1 -mr-1 pt-1" style={DASHED_LINE_STYLE} />
          </div>

          <p
            className={cn(
              "mt-[5px] text-xs leading-[18px] text-muted-foreground transition-all ease-out",
              isExpanded
                ? "pointer-events-none max-h-0 overflow-hidden opacity-0"
                : "line-clamp-4 h-[72px] max-h-24 opacity-100"
            )}
            style={transitionStyle}
          >
            {group.description}
          </p>

          <div
            ref={chipsScrollRef}
            className={cn(
              "flex flex-wrap content-start items-start gap-x-1.5 gap-y-2 pt-0 pb-0 transition-[opacity,transform,margin] ease-out",
              isExpanded
                ? "mt-[6px] min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain touch-pan-y opacity-100 translate-y-0 [scrollbar-width:thin] [scrollbar-color:hsl(185_40%_68%_/_0.45)_transparent]"
                : "pointer-events-none max-h-0 overflow-hidden opacity-0 translate-y-3"
            )}
            style={transitionStyle}
          >
            {visibleAssetNames.map((name) => {
              const key = name.toLowerCase().trim();
              const isSelected = selectedAssetsSet.has(key);
              if (isSelected) {
                const viewHandler =
                  viewAssetByNameKey[key] ??
                  (onViewAsset ? () => onViewAsset(name, group.id) : undefined);
                return (
                  <ExpandableAssetChip
                    key={name}
                    label={name}
                    color={SELECTED_CHIP_TEAL}
                    onRemove={() => onRemoveAsset?.(name)}
                    onRename={
                      onRenameAsset ? () => onRenameAsset(name, group.id) : undefined
                    }
                    onView={viewHandler}
                    onDuplicate={onCopyAsset ? () => onCopyAsset(name, group.id) : undefined}
                    className="!shadow-none"
                  />
                );
              }
              return (
                <SemanticChip
                  key={name}
                  epistemic="proposal"
                  label={name}
                  removable
                  onRemove={() => handleDismissSuggestion(resolveSuggestionSourceKey(name))}
                  onPress={() => handleChipClick(name)}
                />
              );
            })}
          </div>

          <div
            className={cn(
              "mt-auto flex w-full shrink-0 items-center gap-1.5 pt-1 transition-all ease-out",
              isExpanded
                ? "translate-y-0 opacity-100"
                : "pointer-events-none max-h-0 overflow-hidden pt-0 opacity-0 translate-y-2"
            )}
            style={transitionStyle}
          >
            <input
              type="text"
              value={customAssetName}
              onChange={(e) => setCustomAssetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCustomAsset();
                }
              }}
              placeholder="Add asset"
              className={cn(SPACE_GROUP_ADD_INPUT_CLASS, "h-[34px]")}
              style={SPACE_GROUP_ADD_INPUT_SHADOW}
            />
            <button
              type="button"
              onClick={handleAddCustomAsset}
              disabled={!customAssetName.trim()}
              className={cn(
                "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg text-white transition-all",
                "disabled:opacity-50"
              )}
              style={{ backgroundColor: "hsl(var(--primary-deep))" }}
              aria-label="Add asset"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
