/**
 * Progressive Create Task meta rows: Who → Where → Due → Priority stagger in
 * 2s apart after the user starts typing a description. Asset, Tag, and Compliance
 * rows appear once Priority is visible. Hover swaps the section word for proposal
 * chips; confirmed fact chips replace the section word.
 */

import { useEffect, useState, type ReactNode } from "react";
import { User, MapPin, Calendar, AlertTriangle, Box, Tag, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { SemanticChip } from "@/components/chips/semantic";
import type { IntakeChipSlotId } from "@/components/intake/IntakeChipRow";

export type StaggerFactChip = {
  id: string;
  label: string;
  onRemove?: () => void;
  onPress?: () => void;
  icon?: ReactNode;
};

export type StaggerHoverChip = {
  id: string;
  label: string;
  onPress: () => void;
};

type CoreSection = {
  id: IntakeChipSlotId;
  word: string;
  icon: typeof User;
  facts: StaggerFactChip[];
  hoverChips: StaggerHoverChip[];
};

export type IntakeStaggeredSectionsProps = {
  active: boolean;
  whoFacts: StaggerFactChip[];
  whereFacts: StaggerFactChip[];
  whenFacts: StaggerFactChip[];
  priorityFacts: StaggerFactChip[];
  assetFacts: StaggerFactChip[];
  categoryFacts: StaggerFactChip[];
  complianceFacts: StaggerFactChip[];
  whoHover: StaggerHoverChip[];
  whereHover: StaggerHoverChip[];
  whenHover: StaggerHoverChip[];
  priorityHover: StaggerHoverChip[];
  assetHover: StaggerHoverChip[];
  categoryHover: StaggerHoverChip[];
  complianceHover: StaggerHoverChip[];
  openSlot: IntakeChipSlotId | null;
  onOpenSlot: (slot: IntakeChipSlotId) => void;
  /** Expanded slot panel (quick chips / calendar / etc.) */
  slotPanel?: ReactNode;
  /** Actions rendered on the open WHEN fact row, to the right of date/repeat chips. */
  whenInlineActions?: ReactNode;
  className?: string;
};

const STAGGER_MS = 2000;
/** Core rows stagger in; Asset/Tag/Compliance appear together once Priority is visible. */
const CORE_ORDER: IntakeChipSlotId[] = ["who", "where", "when", "priority"];

function StaggerRow({
  section,
  isOpen,
  onOpenSlot,
  slotPanel,
  inlineActions,
}: {
  section: CoreSection;
  isOpen: boolean;
  onOpenSlot: (slot: IntakeChipSlotId) => void;
  slotPanel?: ReactNode;
  /** Proposal/action chips rendered on the fact row (e.g. ADD MILESTONE beside due date). */
  inlineActions?: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);
  const Icon = section.icon;
  const hasFacts = section.facts.length > 0;
  // Hover shows proposal chips; when the slot is open the panel owns actions
  // so the row only keeps fact chips (avoids duplicate TOMORROW / stacked chips).
  const showHoverChips = hovered && !isOpen;
  const factLabels = new Set(
    section.facts.map((f) => f.label.trim().toUpperCase()).filter(Boolean)
  );
  const availableHoverChips = section.hoverChips.filter((chip) => {
    const label = chip.label.trim().toUpperCase();
    if (label && factLabels.has(label)) return false;
    return !section.facts.some(
      (f) =>
        f.id === chip.id ||
        f.id.endsWith(`-${chip.id}`) ||
        f.id === `priority-${chip.id}` ||
        f.id === `status-${chip.id}` ||
        f.id === `compliance-${chip.id}`
    );
  });

  return (
    <div className="animate-in fade-in duration-700 fill-mode-both">
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpenSlot(section.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenSlot(section.id);
          }
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "flex w-full min-h-6 items-center gap-2.5 rounded-card px-1 py-0 text-left transition-colors cursor-pointer",
          isOpen ? "bg-muted/30" : "hover:bg-muted/20"
        )}
      >
        <Icon
          className="h-3.5 w-3.5 shrink-0 self-center text-muted-foreground mr-0.5"
          aria-hidden
        />
        <div
          className={cn(
            "flex min-h-6 min-w-0 flex-1 items-center gap-1",
            section.id === "when"
              ? "flex-nowrap overflow-x-auto no-scrollbar"
              : "flex-wrap"
          )}
        >
          {hasFacts
            ? section.facts.map((chip) => (
                <SemanticChip
                  key={chip.id}
                  epistemic="fact"
                  label={chip.label}
                  icon={chip.icon}
                  truncate={false}
                  removable={Boolean(chip.onRemove)}
                  onRemove={chip.onRemove}
                  onPress={chip.onPress}
                  pressOnPointerDown={Boolean(chip.onPress)}
                  className="h-6 shrink-0 max-w-none text-caption"
                />
              ))
            : null}

          {!hasFacts && !showHoverChips && !isOpen ? (
            <span className="inline-flex h-6 items-center font-mono text-caption uppercase tracking-wide text-muted-foreground leading-none">
              {section.word}
            </span>
          ) : null}

          {showHoverChips
            ? availableHoverChips.map((chip) => (
                <span
                  key={chip.id}
                  className="inline-flex shrink-0"
                  // Prevent row onClick from opening the slot before the chip action runs,
                  // and skip pressOnPointerDown transfer — that delay unmounts these chips
                  // (hover → open) and clears the pending onPress (+ DATE looked like a no-op).
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <SemanticChip
                    epistemic="proposal"
                    label={chip.label}
                    truncate={false}
                    onPress={() => chip.onPress()}
                    className="h-6 shrink-0 max-w-none py-0 text-caption"
                  />
                </span>
              ))
            : null}

          {/* Open + no chips yet: keep the section word. Date/repeat chips sit on this
              row via inlineActions so they stay with fact chips (e.g. 2 WEEKS). */}
          {!hasFacts && isOpen && !showHoverChips && !inlineActions ? (
            <span className="inline-flex h-6 items-center font-mono text-caption uppercase tracking-wide text-muted-foreground leading-none">
              {section.word}
            </span>
          ) : null}

          {isOpen && inlineActions ? (
            <span
              className="inline-flex shrink-0 flex-nowrap items-center gap-1"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {inlineActions}
            </span>
          ) : null}
        </div>
      </div>
      {isOpen && slotPanel ? (
        <div className="ml-6 mt-1 mb-1.5 min-w-0">{slotPanel}</div>
      ) : null}
    </div>
  );
}

export function IntakeStaggeredSections({
  active,
  whoFacts,
  whereFacts,
  whenFacts,
  priorityFacts,
  assetFacts,
  categoryFacts,
  complianceFacts,
  whoHover,
  whereHover,
  whenHover,
  priorityHover,
  assetHover,
  categoryHover,
  complianceHover,
  openSlot,
  onOpenSlot,
  slotPanel,
  whenInlineActions,
  className,
}: IntakeStaggeredSectionsProps) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (!active) {
      setVisibleCount(0);
      return;
    }
    setVisibleCount(1);
    const timers: number[] = [];
    for (let i = 2; i <= CORE_ORDER.length; i += 1) {
      timers.push(
        window.setTimeout(() => {
          setVisibleCount(i);
        }, (i - 1) * STAGGER_MS)
      );
    }
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [active]);

  const coreSections: CoreSection[] = [
    { id: "who", word: "Who?", icon: User, facts: whoFacts, hoverChips: whoHover },
    { id: "where", word: "Where?", icon: MapPin, facts: whereFacts, hoverChips: whereHover },
    { id: "when", word: "Due Date", icon: Calendar, facts: whenFacts, hoverChips: whenHover },
    {
      id: "priority",
      word: "Priority",
      icon: AlertTriangle,
      facts: priorityFacts,
      hoverChips: priorityHover,
    },
  ];

  const metaSections: CoreSection[] = [
    { id: "asset", word: "Asset", icon: Box, facts: assetFacts, hoverChips: assetHover },
    { id: "category", word: "Tag", icon: Tag, facts: categoryFacts, hoverChips: categoryHover },
    {
      id: "compliance",
      word: "Compliance",
      icon: Shield,
      facts: complianceFacts,
      hoverChips: complianceHover,
    },
  ];

  const showMeta = visibleCount >= CORE_ORDER.length;

  if (!active) return null;

  return (
    <div className={cn("space-y-1 pt-1.5", className)}>
      {coreSections.map((section, index) => {
        if (index >= visibleCount) return null;
        return (
          <StaggerRow
            key={section.id}
            section={section}
            isOpen={openSlot === section.id}
            onOpenSlot={onOpenSlot}
            slotPanel={openSlot === section.id ? slotPanel : undefined}
            inlineActions={
              openSlot === section.id && section.id === "when" ? whenInlineActions : undefined
            }
          />
        );
      })}

      {showMeta
        ? metaSections.map((section) => (
            <StaggerRow
              key={section.id}
              section={section}
              isOpen={openSlot === section.id}
              onOpenSlot={onOpenSlot}
              slotPanel={openSlot === section.id ? slotPanel : undefined}
            />
          ))
        : null}
    </div>
  );
}
