import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/chips/Chip";
import { CopyPlus } from "lucide-react";
import type { SpaceGroup } from "./onboardingSpaceGroups";
import { shortSpaceLabel } from "./onboardingSpaceGroups";

const FLIP_IN_DURATION_MS = 250;
const FLIP_OUT_DURATION_MS = 600;
const LEAVE_DELAY_MS = 1500;

// Back card height from chip count: ~2 chips per row; one chip row of padding at bottom
const CHIP_ROW_HEIGHT = 34;
const COLS = 2;
const BACK_HEADER_PX = 50;
const CARD_HEIGHT_MIN = 140;
const CARD_HEIGHT_MAX = 260;

function cardHeightFromChipCount(count: number): number {
  const rows = Math.ceil(count / COLS);
  const backContent = BACK_HEADER_PX + rows * CHIP_ROW_HEIGHT + CHIP_ROW_HEIGHT; // +1 row padding at bottom
  return Math.min(CARD_HEIGHT_MAX, Math.max(CARD_HEIGHT_MIN, backContent));
}

// Ghost chip: white dashed stroke only (no dark border), lighter fill on hover
const GHOST_CHIP_CLASS =
  "!bg-transparent !border !border-transparent !border-dashed !opacity-100 text-[#1C1C1C] font-mono uppercase tracking-wide hover:!bg-white/25 !shadow-none !h-[28px] min-h-[28px] px-2.5 py-1.5 cursor-pointer";

// Selected chip on card (e.g. ENTRANCE with copy button): same ghost style but teal text/icon to match others
const SELECTED_CHIP_TEAL = "#85BABC";

interface OnboardingSpaceGroupCardProps {
  group: SpaceGroup;
  /** Set of space names already selected (case-insensitive). Used to show copy-plus on selected chips. */
  selectedSpacesSet: Set<string>;
  onAddSpace: (name: string) => void;
  /** When user clicks copy-plus on a selected chip, suggests a new name (e.g. "Bedroom 2") and adds it. */
  onCopySpace?: (name: string) => void;
  className?: string;
}

export function OnboardingSpaceGroupCard({
  group,
  selectedSpacesSet,
  onAddSpace,
  onCopySpace,
  className,
}: OnboardingSpaceGroupCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [flipDurationMs, setFlipDurationMs] = useState(FLIP_IN_DURATION_MS);
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flipBackEndRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    if (flipBackEndRef.current) {
      clearTimeout(flipBackEndRef.current);
      flipBackEndRef.current = null;
    }
    setFlipDurationMs(FLIP_IN_DURATION_MS);
    setIsFlipped(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    leaveTimeoutRef.current = setTimeout(() => {
      leaveTimeoutRef.current = null;
      setFlipDurationMs(FLIP_OUT_DURATION_MS);
      requestAnimationFrame(() => {
        setIsFlipped(false);
        flipBackEndRef.current = setTimeout(() => {
          flipBackEndRef.current = null;
          setFlipDurationMs(FLIP_IN_DURATION_MS);
        }, FLIP_OUT_DURATION_MS);
      });
    }, LEAVE_DELAY_MS);
  }, []);

  const handleChipClick = (name: string) => {
    const key = name.toLowerCase().trim();
    if (selectedSpacesSet.has(key)) return;
    onAddSpace(name);
  };

  // Slightly darker paper for flipped (back) face. Paper bg = #F1EEE8.
  const paperBackBg = "#E8E5E0";
  const cardHeightPx = cardHeightFromChipCount(group.suggestedSpaces.length);

  return (
    <div
      className={cn("w-[200px] flex-shrink-0 perspective-[800px]", className)}
      style={{ perspectiveOrigin: "50% 50%", height: `${cardHeightPx}px` }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="relative w-full h-full transition-transform ease-out"
        style={{
          transformStyle: "preserve-3d",
          transformOrigin: "50% 50%",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          transitionDuration: `${flipDurationMs}ms`,
        }}
      >
        {/* Front: title + description; pointer-events-none so the back face receives clicks when flipped */}
        <div
          className="absolute inset-0 rounded-[8px] overflow-hidden bg-card shadow-e1 flex flex-col pointer-events-none"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          <div className="flex-1 pt-4 pb-3 px-3 space-y-3">
            <h3 className="font-semibold text-lg text-foreground leading-tight">
              {group.label}
            </h3>
            <div
              className="-ml-1 -mr-1 pt-1"
              style={{
                height: "1px",
                backgroundImage: "repeating-linear-gradient(to right, #E2DBCB 0px, #E2DBCB 4px, transparent 4px, transparent 7px)",
                backgroundSize: "7px 1px",
                backgroundRepeat: "repeat-x",
              }}
            />
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
              {group.description}
            </p>
          </div>
        </div>

        {/* Back: ghost chips — slightly darker paper + texture; pointer-events-auto so chips receive clicks */}
        <div
          className="absolute inset-0 rounded-[8px] overflow-hidden shadow-e1 flex flex-col pointer-events-auto"
          style={{
            backgroundColor: paperBackBg,
            backgroundImage: "var(--paper-texture)",
            backgroundSize: "100%",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <div className="flex-1 pt-3 pb-3 px-3 overflow-auto">
            <p className="text-xs text-muted-foreground mb-3 mt-1 ml-2 font-medium font-mono uppercase tracking-wide">
              {group.label}
            </p>
            <div className="flex flex-wrap gap-1.5 items-center">
              {group.suggestedSpaces.map((name) => {
                const key = name.toLowerCase().trim();
                const isSelected = selectedSpacesSet.has(key);
                if (isSelected && onCopySpace) {
                  return (
                    <div
                      key={name}
                      className={cn(
                        GHOST_CHIP_CLASS,
                        "relative inline-flex items-center gap-0 pr-0 text-[11px] rounded-[8px] group/chip",
                        "hover:!bg-white/25 transition-colors duration-150",
                        "border-0 !border-0 !shadow-none"
                      )}
                      style={{ color: SELECTED_CHIP_TEAL }}
                    >
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none rounded-[8px]"
                        style={{ borderRadius: 8 }}
                        aria-hidden
                      >
                        <rect
                          x="1"
                          y="1"
                          width="calc(100% - 2px)"
                          height="calc(100% - 2px)"
                          rx="8"
                          ry="8"
                          fill="none"
                          stroke="white"
                          strokeWidth="2"
                          strokeDasharray="2 2"
                        />
                      </svg>
                      <span className="truncate max-w-[100px] relative z-[1]" style={{ color: SELECTED_CHIP_TEAL }}>
                        {shortSpaceLabel(name)}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCopySpace(name);
                        }}
                        className={cn(
                          "flex-shrink-0 inline-flex items-center justify-center relative z-[1] w-[30px]",
                          "!pl-0 !pr-2 !py-1.5 text-[11px] font-mono uppercase tracking-wide rounded-r-[8px]",
                          "!bg-transparent hover:!bg-transparent !shadow-none outline-none",
                          "transition-colors duration-150 appearance-none border-0"
                        )}
                        style={{ color: SELECTED_CHIP_TEAL }}
                        title="Add another (copy)"
                        aria-label={`Add copy of ${name}`}
                      >
                        <CopyPlus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                }
                return (
                  <Chip
                    key={name}
                    role="suggestion"
                    label={shortSpaceLabel(name)}
                    onSelect={() => handleChipClick(name)}
                    className={GHOST_CHIP_CLASS}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
