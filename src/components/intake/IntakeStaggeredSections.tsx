/**
 * Progressive Create Task meta rows: Who → Where → Due → Priority stagger in
 * 2s apart after the user starts typing a description. Hover swaps the section
 * word for proposal chips; confirmed fact chips replace the section word.
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

type OptionalChip = {
  id: string;
  label: string;
  onPress: () => void;
};

export type IntakeStaggeredSectionsProps = {
  active: boolean;
  whoFacts: StaggerFactChip[];
  whereFacts: StaggerFactChip[];
  whenFacts: StaggerFactChip[];
  priorityFacts: StaggerFactChip[];
  whoHover: StaggerHoverChip[];
  whereHover: StaggerHoverChip[];
  whenHover: StaggerHoverChip[];
  priorityHover: StaggerHoverChip[];
  optionalChips: OptionalChip[];
  openSlot: IntakeChipSlotId | null;
  onOpenSlot: (slot: IntakeChipSlotId) => void;
  /** Expanded slot panel (quick chips / calendar / etc.) */
  slotPanel?: ReactNode;
  /** Single-property orgs treat location as satisfied without showing a property chip. */
  whereSatisfiedWithoutChip?: boolean;
  className?: string;
};

const STAGGER_MS = 2000;
const CORE_ORDER: IntakeChipSlotId[] = ["who", "where", "when", "priority"];

function StaggerRow({
  section,
  isOpen,
  onOpenSlot,
  slotPanel,
}: {
  section: CoreSection;
  isOpen: boolean;
  onOpenSlot: (slot: IntakeChipSlotId) => void;
  slotPanel?: ReactNode;
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
        f.id === `status-${chip.id}`
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
        <div className="flex min-h-6 min-w-0 flex-1 flex-wrap items-center gap-1">
          {hasFacts
            ? section.facts.map((chip) => (
                <SemanticChip
                  key={chip.id}
                  epistemic="fact"
                  label={chip.label}
                  truncate={false}
                  removable={Boolean(chip.onRemove)}
                  onRemove={chip.onRemove}
                  onPress={chip.onPress}
                  pressOnPointerDown={Boolean(chip.onPress)}
                  className="h-6 shrink-0 text-caption"
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
                <SemanticChip
                  key={chip.id}
                  epistemic="proposal"
                  label={chip.label}
                  truncate={false}
                  pressOnPointerDown
                  onPress={() => chip.onPress()}
                  className="h-6 shrink-0 max-w-none py-0 text-caption"
                />
              ))
            : null}

          {!hasFacts && isOpen
            ? availableHoverChips.map((chip) => (
                <SemanticChip
                  key={`open-${chip.id}`}
                  epistemic="proposal"
                  label={chip.label}
                  truncate={false}
                  pressOnPointerDown
                  onPress={() => chip.onPress()}
                  className="h-6 shrink-0 max-w-none py-0 text-caption"
                />
              ))
            : null}
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
  whoHover,
  whereHover,
  whenHover,
  priorityHover,
  optionalChips,
  openSlot,
  onOpenSlot,
  slotPanel,
  whereSatisfiedWithoutChip = false,
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

  const sections: CoreSection[] = [
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

  const coreConfirmed =
    whoFacts.length > 0 &&
    (whereFacts.length > 0 || whereSatisfiedWithoutChip) &&
    whenFacts.length > 0;

  if (!active) return null;

  return (
    <div className={cn("space-y-1 pt-1.5", className)}>
      {sections.map((section, index) => {
        if (index >= visibleCount) return null;
        return (
          <StaggerRow
            key={section.id}
            section={section}
            isOpen={openSlot === section.id}
            onOpenSlot={onOpenSlot}
            slotPanel={openSlot === section.id ? slotPanel : undefined}
          />
        );
      })}

      {coreConfirmed && optionalChips.length > 0 ? (
        <div className="flex min-h-6 flex-wrap items-center gap-1 px-1 pt-0.5 animate-in fade-in duration-500">
          <span className="mr-1 inline-flex h-6 items-center font-mono text-caption uppercase tracking-wide text-muted-foreground leading-none">
            Optional
          </span>
          <Box className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          {optionalChips
            .filter((c) => c.id.startsWith("asset") || c.label.includes("ASSET"))
            .map((chip) => (
              <SemanticChip
                key={chip.id}
                epistemic="proposal"
                label={chip.label}
                truncate={false}
                pressOnPointerDown
                onPress={chip.onPress}
                className="h-6 shrink-0 max-w-none py-0 text-caption"
              />
            ))}
          <Tag className="ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          {optionalChips
            .filter((c) => c.id.startsWith("tag") || c.id.startsWith("category") || c.label.includes("TAG"))
            .map((chip) => (
              <SemanticChip
                key={chip.id}
                epistemic="proposal"
                label={chip.label}
                truncate={false}
                pressOnPointerDown
                onPress={chip.onPress}
                className="h-6 shrink-0 max-w-none py-0 text-caption"
              />
            ))}
          <Shield className="ml-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          {optionalChips
            .filter(
              (c) =>
                c.id.startsWith("rule") ||
                c.id.startsWith("compliance") ||
                c.label.includes("RULE")
            )
            .map((chip) => (
              <SemanticChip
                key={chip.id}
                epistemic="proposal"
                label={chip.label}
                truncate={false}
                pressOnPointerDown
                onPress={chip.onPress}
                className="h-6 shrink-0 max-w-none py-0 text-caption"
              />
            ))}
        </div>
      ) : null}
    </div>
  );
}
