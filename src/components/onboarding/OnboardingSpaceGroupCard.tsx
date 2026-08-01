import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { SemanticChip, ExpandableSpaceChip } from "@/components/chips/semantic";
import { Plus } from "lucide-react";
import type {
  GroupExtraSpace,
  SpaceGroup,
  SuggestionLabelOverrides,
} from "./onboardingSpaceGroups";
import { shortSpaceLabel } from "./onboardingSpaceGroups";
import { SpaceGroupCardBanner } from "@/components/spaces/SpaceGroupCardBanner";
import { getSpaceGroupCardIllustration } from "@/lib/spaceGroupIllustrations";
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

interface OnboardingSpaceGroupCardProps {
  group: SpaceGroup;
  /** Set of space names already selected (case-insensitive). Used to show copy-plus on selected chips. */
  selectedSpacesSet: Set<string>;
  /** Custom and duplicated spaces shown on this card (not in suggestedSpaces). */
  extraSpaces?: GroupExtraSpace[];
  /**
   * Selected space names for this group, newest first.
   * When set, selected chips (suggestions + custom) pin to the top in this order.
   */
  selectedSpacesNewestFirst?: string[];
  /** Case-insensitive filter applied to chip labels. */
  spaceFilter?: string;
  /** Display names for renamed suggestion chips (key = original suggestion, lowercased). */
  suggestionLabelOverrides?: SuggestionLabelOverrides;
  subSpacesByParent?: Record<string, string[]>;
  onAddSpace: (name: string, extra?: boolean) => void;
  onRemoveSpace?: (name: string) => void;
  onRenameSpace?: (name: string, groupId: string) => void;
  /** Open the space detail surface. */
  onViewSpace?: (name: string, groupId: string) => void;
  /** Prefers id-based navigation when the space already exists (name key → open). */
  viewSpaceByNameKey?: Record<string, () => void>;
  /** When user chooses Duplicate, suggests a new name (e.g. "Bedroom 2") and adds it. */
  onCopySpace?: (name: string, groupId: string) => void;
  onAddSubSpace?: (parentSpace: string, subSpaceName: string) => void;
  className?: string;
}

const BANNER_HEIGHT_PX = 130;
const BANNER_COLLAPSED_HEIGHT_PX = 70;

export function OnboardingSpaceGroupCard({
  group,
  selectedSpacesSet,
  extraSpaces = [],
  selectedSpacesNewestFirst,
  spaceFilter = "",
  suggestionLabelOverrides = {},
  subSpacesByParent = {},
  onAddSpace,
  onRemoveSpace,
  onRenameSpace,
  onViewSpace,
  viewSpaceByNameKey = {},
  onCopySpace,
  onAddSubSpace,
  className,
}: OnboardingSpaceGroupCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [transitionMs, setTransitionMs] = useState(EXPAND_DURATION_MS);
  const [customSpaceName, setCustomSpaceName] = useState("");
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const enterTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** After collapsing via banner click, ignore hover until pointer leaves the card. */
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
    if (selectedSpacesSet.has(key)) return;
    onAddSpace(name);
  };

  const handleAddCustomSpace = () => {
    const trimmed = customSpaceName.trim();
    if (!trimmed) return;
    onAddSpace(trimmed, true);
    setCustomSpaceName("");
  };

  const handleDismissSuggestion = (sourceKey: string) => {
    setDismissedSuggestions((prev) => new Set(prev).add(sourceKey));
  };

  const resolveSuggestionSourceKey = (displayName: string): string => {
    const displayKey = displayName.toLowerCase().trim();
    for (const [sourceKey, label] of Object.entries(suggestionLabelOverrides)) {
      if (label.toLowerCase().trim() === displayKey) return sourceKey;
    }
    for (const name of group.suggestedSpaces) {
      if (name.toLowerCase().trim() === displayKey) return displayKey;
    }
    return displayKey;
  };

  const visibleSpaceNames = useMemo(() => {
    const filter = spaceFilter.trim().toLowerCase();
    const matchesFilter = (name: string) =>
      !filter || name.toLowerCase().includes(filter);

    const suggestionSeen = new Set<string>();
    const suggestions: string[] = [];

    for (const name of group.suggestedSpaces) {
      if (typeof name !== "string" || !name.trim()) continue;
      const sourceKey = name.toLowerCase().trim();
      if (dismissedSuggestions.has(sourceKey)) continue;
      const displayName = suggestionLabelOverrides[sourceKey] ?? name;
      const displayKey = displayName.toLowerCase().trim();
      if (suggestionSeen.has(displayKey)) continue;
      suggestionSeen.add(displayKey);
      suggestions.push(displayName);
    }

    // Contract: extraSpaces[0] is newest — pin those chips to the top (fallback path).
    const extrasNewestFirst: string[] = [];
    const extrasInsertAfter: { name: string; afterKey: string }[] = [];
    for (const extra of extraSpaces) {
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
      if (selectedSpacesSet.has(key)) selectedSuggestions.push(displayName);
      else unselectedSuggestions.push(displayName);
    }

    // Prefer explicit newest-first order so newly added / selected chips pin to the top.
    let selectedOrdered: string[];
    if (selectedSpacesNewestFirst && selectedSpacesNewestFirst.length > 0) {
      const seenSelected = new Set<string>();
      selectedOrdered = [];
      for (const name of selectedSpacesNewestFirst) {
        if (!name?.trim()) continue;
        const key = name.toLowerCase().trim();
        if (seenSelected.has(key)) continue;
        if (!selectedSpacesSet.has(key)) continue;
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

    // Duplicates (Bedroom 2 after Bedroom) keep sibling placement when not already ordered.
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
    group.suggestedSpaces,
    extraSpaces,
    selectedSpacesNewestFirst,
    spaceFilter,
    dismissedSuggestions,
    suggestionLabelOverrides,
    selectedSpacesSet,
  ]);

  useEffect(() => {
    const leading = visibleSpaceNames[0] ?? null;
    if (leading && leading !== prevLeadingChipRef.current && isExpanded) {
      chipsScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
    prevLeadingChipRef.current = leading;
  }, [visibleSpaceNames, isExpanded]);

  const transitionStyle = { transitionDuration: `${transitionMs}ms` };

  return (
    <div
      className={cn("w-[230px] h-[295px] flex-shrink-0", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative flex h-full flex-col gap-0 overflow-hidden rounded-card bg-card pb-[3px] shadow-e1">
        {/* Banner — collapses to 70px on expand */}
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
            imageSrc={getSpaceGroupCardIllustration(group.id)}
            alt={group.label}
            color={group.color}
            className="h-full"
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-0 px-3 pb-2 pt-2">
          {/* Title + dashed rule — slides to card top as banner collapses */}
          <div className="shrink-0 space-y-2 transition-transform ease-out" style={transitionStyle}>
            <h3 className="text-lg font-semibold leading-tight text-foreground">{group.label}</h3>
            <div className="-ml-1 -mr-1 pt-1" style={DASHED_LINE_STYLE} />
          </div>

          {/* Description — fades out on expand */}
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

          {/* Space chips — scroll vertically when they overflow the card */}
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
            {visibleSpaceNames.map((name) => {
              const key = name.toLowerCase().trim();
              const isSelected = selectedSpacesSet.has(key);
              if (isSelected) {
                const viewHandler =
                  viewSpaceByNameKey[key] ??
                  (onViewSpace ? () => onViewSpace(name, group.id) : undefined);
                return (
                  <ExpandableSpaceChip
                    key={name}
                    label={shortSpaceLabel(name)}
                    color={SELECTED_CHIP_TEAL}
                    subSpaces={subSpacesByParent[key] ?? []}
                    onRemove={() => onRemoveSpace?.(name)}
                    onAddSubSpace={(subName) => onAddSubSpace?.(name, subName)}
                    onRename={
                      onRenameSpace ? () => onRenameSpace(name, group.id) : undefined
                    }
                    onView={viewHandler}
                    onDuplicate={onCopySpace ? () => onCopySpace(name, group.id) : undefined}
                    className="!shadow-none"
                  />
                );
              }
              return (
                <SemanticChip
                  key={name}
                  epistemic="proposal"
                  label={shortSpaceLabel(name)}
                  removable
                  onRemove={() => handleDismissSuggestion(resolveSuggestionSourceKey(name))}
                  onPress={() => handleChipClick(name)}
                />
              );
            })}
          </div>

          {/* Add Space — pinned to card bottom when expanded */}
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
              value={customSpaceName}
              onChange={(e) => setCustomSpaceName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddCustomSpace();
                }
              }}
              placeholder="Add space"
              className={cn(SPACE_GROUP_ADD_INPUT_CLASS, "h-[34px]")}
              style={SPACE_GROUP_ADD_INPUT_SHADOW}
            />
            <button
              type="button"
              onClick={handleAddCustomSpace}
              disabled={!customSpaceName.trim()}
              className={cn(
                "flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg text-white transition-all",
                "disabled:opacity-50"
              )}
              style={{ backgroundColor: "hsl(var(--primary-deep))" }}
              aria-label="Add space"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
