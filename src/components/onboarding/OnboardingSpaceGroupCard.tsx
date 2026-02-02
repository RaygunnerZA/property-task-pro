import { useState } from "react";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/chips/Chip";
import { CopyPlus } from "lucide-react";
import type { SpaceGroup } from "./onboardingSpaceGroups";

// Ghost chip: white dashed stroke only (no dark border), lighter fill on hover
const GHOST_CHIP_CLASS =
  "!bg-transparent !border !border-transparent !border-dashed !opacity-100 text-[#1C1C1C] font-mono uppercase tracking-wide hover:!bg-white/25 !shadow-none !h-[28px] min-h-[28px] px-2.5 py-1.5 cursor-pointer";

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

  const handleChipClick = (name: string) => {
    const key = name.toLowerCase().trim();
    if (selectedSpacesSet.has(key)) return;
    onAddSpace(name);
  };

  // Slightly darker paper for flipped (back) face. Paper bg = #F1EEE8.
  const paperBackBg = "#E8E5E0";

  return (
    <div
      className={cn("w-[200px] flex-shrink-0 h-[260px] perspective-[800px]", className)}
      style={{ perspectiveOrigin: "50% 50%" }}
      onMouseEnter={() => setIsFlipped(true)}
      onMouseLeave={() => setIsFlipped(false)}
    >
      <div
        className="relative w-full h-full transition-transform duration-[250ms] ease-out"
        style={{
          transformStyle: "preserve-3d",
          transformOrigin: "50% 50%",
          transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
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
                      className={cn(GHOST_CHIP_CLASS, "inline-flex items-center gap-1.5 pr-0")}
                    >
                      <span className="truncate max-w-[100px]">{name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCopySpace(name);
                        }}
                        className={cn(
                          "flex-shrink-0 inline-flex items-center justify-center",
                          GHOST_CHIP_CLASS,
                          "!px-2 !py-1.5"
                        )}
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
                    label={name}
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
