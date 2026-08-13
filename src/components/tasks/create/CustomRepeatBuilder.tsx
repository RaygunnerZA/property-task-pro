/**
 * Custom repeat builder — aligned to Priority / Due Date SemanticChip rows.
 * Flow: change interval or period → CONFIRM appears → tap CONFIRM to commit.
 * Emits interval + unit for the parent to commit.
 */

import { useEffect, useState } from "react";
import { Check, Repeat } from "lucide-react";
import { SemanticChip } from "@/components/chips/semantic";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type CustomRepeatUnit = "days" | "weeks" | "months" | "years";

const UNITS: Array<{ unit: CustomRepeatUnit; label: string }> = [
  { unit: "days", label: "DAYS" },
  { unit: "weeks", label: "WEEKS" },
  { unit: "months", label: "MONTHS" },
  { unit: "years", label: "YEARS" },
];

export function formatCustomRepeatLabel(interval: number, unit: CustomRepeatUnit): string {
  const n = Math.max(1, Math.min(99, interval || 1));
  if (n === 1) {
    const singular =
      unit === "days" ? "DAY" : unit === "weeks" ? "WEEK" : unit === "months" ? "MONTH" : "YEAR";
    return `1 ${singular}`;
  }
  return `${n} ${unit.toUpperCase()}`;
}

export function unitToRepeatType(unit: CustomRepeatUnit): "daily" | "weekly" | "monthly" | "yearly" {
  if (unit === "days") return "daily";
  if (unit === "weeks") return "weekly";
  if (unit === "months") return "monthly";
  return "yearly";
}

interface CustomRepeatBuilderProps {
  onConfirm: (interval: number, unit: CustomRepeatUnit) => void;
  className?: string;
  /** Reset draft when parent re-opens the builder. */
  resetKey?: string | number | boolean;
}

export function CustomRepeatBuilder({ onConfirm, className, resetKey }: CustomRepeatBuilderProps) {
  const [intervalDraft, setIntervalDraft] = useState(2);
  const [unitDraft, setUnitDraft] = useState<CustomRepeatUnit>("weeks");
  const [intervalPicked, setIntervalPicked] = useState(false);
  const [unitPicked, setUnitPicked] = useState(false);

  useEffect(() => {
    setIntervalDraft(2);
    setUnitDraft("weeks");
    setIntervalPicked(false);
    setUnitPicked(false);
  }, [resetKey]);

  const canConfirm = intervalPicked || unitPicked;

  const commit = (interval: number, unit: CustomRepeatUnit) => {
    onConfirm(Math.max(1, Math.min(99, interval || 1)), unit);
  };

  return (
    <div className={cn("flex items-center gap-2 w-full min-w-0 flex-wrap", className)}>
      {/* Anchor chip — same raised treatment as PRIORITY left chip */}
      <div className="inline-flex items-center gap-1.5 pl-[9px] pr-1.5 py-1.5 rounded-card h-[28px] bg-background text-foreground shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_2px_rgba(255,255,255,0.7)] shrink-0 font-mono">
        <span className="text-xs uppercase leading-[16px]">Repeat</span>
        <Repeat className="h-3.5 w-3.5" />
      </div>

      <SemanticChip
        epistemic={intervalPicked ? "fact" : "proposal"}
        label={String(intervalDraft)}
        truncate={false}
        dropdown
        dropdownContent={
          <div className="max-h-48 overflow-y-auto">
            {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => (
              <DropdownMenuItem
                key={n}
                className="font-mono text-2xs uppercase tracking-wide"
                onSelect={() => {
                  setIntervalDraft(n);
                  setIntervalPicked(true);
                }}
              >
                {n}
              </DropdownMenuItem>
            ))}
          </div>
        }
        className="shrink-0 max-w-none"
      />

      <SemanticChip
        epistemic={unitPicked ? "fact" : "proposal"}
        label={unitDraft.toUpperCase()}
        truncate={false}
        dropdown
        dropdownContent={
          <>
            {UNITS.map(({ unit, label }) => (
              <DropdownMenuItem
                key={unit}
                className="font-mono text-2xs uppercase tracking-wide"
                onSelect={() => {
                  setUnitDraft(unit);
                  setUnitPicked(true);
                }}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </>
        }
        className="shrink-0 max-w-none"
      />

      {canConfirm ? (
        <SemanticChip
          epistemic="proposal"
          label="CONFIRM"
          icon={<Check className="h-3 w-3" />}
          truncate={false}
          onPress={() => commit(intervalDraft, unitDraft)}
          className="shrink-0 max-w-none"
        />
      ) : null}
    </div>
  );
}
