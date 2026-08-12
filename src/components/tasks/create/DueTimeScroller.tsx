/**
 * Neumorphic vertical time scroller (hour / minute / AM-PM) extracted from WhenPanel.
 * Pair with FillaMiniCalendar for Create Task custom due.
 * Click (without scrolling) on a wheel opens a text input for that field.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { format, parseISO, setHours, setMinutes } from "date-fns";

const TIME_CELL_H = 26;
const TIME_VISIBLE = 3;
const CLICK_MOVE_PX = 6;

function itemStyle(distance: number): React.CSSProperties {
  if (distance === 0) return { opacity: 1, filter: "none" };
  if (distance === 1) return { opacity: 0.4, filter: "blur(1.5px)" };
  if (distance === 2) return { opacity: 0.15, filter: "blur(3px)" };
  return { opacity: 0, filter: "blur(4px)", pointerEvents: "none" };
}

function ScrollWheel({
  values,
  selectedIndex,
  onSelect,
  onRequestEdit,
  formatValue = (v: string | number) => String(v).padStart(2, "0"),
  width = 32,
  capsuleBg,
  capsuleStyle,
  textStyle,
}: {
  values: (string | number)[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Fired when the user clicks the wheel without scrolling (enter text edit). */
  onRequestEdit?: () => void;
  formatValue?: (v: string | number) => string;
  width?: number;
  capsuleBg?: string;
  capsuleStyle?: React.CSSProperties;
  textStyle?: React.CSSProperties;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScroll = useRef(true);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visualIdx, setVisualIdx] = useState(selectedIndex);
  const pointerRef = useRef<{ y: number; scrollTop: number; moved: boolean } | null>(null);
  const scrolledSincePointer = useRef(false);

  useEffect(() => {
    if (!scrollRef.current) return;
    isUserScroll.current = false;
    scrollRef.current.scrollTo({ top: selectedIndex * TIME_CELL_H, behavior: "auto" });
    const id = setTimeout(() => {
      isUserScroll.current = true;
    }, 100);
    return () => clearTimeout(id);
  }, [selectedIndex]);

  useEffect(() => {
    setVisualIdx(selectedIndex);
  }, [selectedIndex]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || !isUserScroll.current) return;
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      if (!scrollRef.current) return;
      const idx = Math.round(scrollRef.current.scrollTop / TIME_CELL_H);
      if (idx >= 0 && idx < values.length && idx !== selectedIndex) {
        onSelect(idx);
      }
      scrollRef.current.scrollTo({ top: idx * TIME_CELL_H, behavior: "smooth" });
    }, 120);
  }, [values.length, selectedIndex, onSelect]);

  const handleScrollVisual = useCallback(() => {
    if (!scrollRef.current) return;
    const idx = Math.round(scrollRef.current.scrollTop / TIME_CELL_H);
    setVisualIdx(idx);
    if (pointerRef.current) {
      const delta = Math.abs(scrollRef.current.scrollTop - pointerRef.current.scrollTop);
      if (delta > CLICK_MOVE_PX) {
        scrolledSincePointer.current = true;
        pointerRef.current.moved = true;
      }
    }
    handleScroll();
  }, [handleScroll]);

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerRef.current = {
      y: e.clientY,
      scrollTop: scrollRef.current?.scrollTop ?? 0,
      moved: false,
    };
    scrolledSincePointer.current = false;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const start = pointerRef.current;
    pointerRef.current = null;
    if (!start || !onRequestEdit) return;
    const dy = Math.abs(e.clientY - start.y);
    if (!start.moved && !scrolledSincePointer.current && dy <= CLICK_MOVE_PX) {
      e.preventDefault();
      onRequestEdit();
    }
  };

  const totalH = TIME_CELL_H * TIME_VISIBLE;
  const pad = TIME_CELL_H;

  return (
    <div className="relative" style={{ width }}>
      <div
        className={cn(
          "absolute left-0 right-0 rounded-card pointer-events-none shadow-[inset_2px_6.4px_4px_0px_rgba(0,0,0,0.15),inset_0px_-1px_1px_0px_rgba(255,255,255,1),inset_0px_3px_2px_-1px_rgba(0,0,0,0.2)]",
          capsuleBg || "bg-[rgba(233,230,226,1)]"
        )}
        style={{ top: 21, height: 36, zIndex: 0, ...capsuleStyle }}
      />
      <div
        ref={scrollRef}
        onScroll={handleScrollVisual}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          pointerRef.current = null;
        }}
        className="relative overflow-y-auto no-scrollbar"
        style={{ height: totalH, scrollbarWidth: "none", msOverflowStyle: "none", zIndex: 1 }}
      >
        <div style={{ height: pad }} />
        {values.map((value, idx) => {
          const dist = Math.abs(idx - visualIdx);
          return (
            <div
              key={idx}
              className="w-full flex items-center justify-center font-mono text-xs select-none text-foreground transition-[filter,opacity] duration-100"
              style={{ height: TIME_CELL_H, ...itemStyle(dist), ...textStyle }}
              aria-hidden
            >
              {formatValue(value)}
            </div>
          );
        })}
        <div style={{ height: pad }} />
      </div>
    </div>
  );
}

function TimeTextField({
  value,
  width,
  capsuleBg,
  textClassName,
  inputMode,
  maxLength,
  onCommit,
  onCancel,
}: {
  value: string;
  width: number;
  capsuleBg?: string;
  textClassName?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  onCommit: (raw: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 20);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="relative flex items-center justify-center" style={{ width, height: TIME_CELL_H * TIME_VISIBLE }}>
      <div
        className={cn(
          "absolute left-0 right-0 rounded-card pointer-events-none shadow-[inset_2px_6.4px_4px_0px_rgba(0,0,0,0.15),inset_0px_-1px_1px_0px_rgba(255,255,255,1),inset_0px_3px_2px_-1px_rgba(0,0,0,0.2)]",
          capsuleBg || "bg-[rgba(233,230,226,1)]"
        )}
        style={{ top: 21, height: 36, zIndex: 0 }}
      />
      <input
        ref={inputRef}
        type="text"
        value={draft}
        maxLength={maxLength}
        inputMode={inputMode}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit(draft);
          }
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={() => onCommit(draft)}
        className={cn(
          "relative z-[1] w-full bg-transparent border-0 outline-none text-center font-mono text-xs text-foreground caret-foreground",
          textClassName
        )}
        aria-label="Edit time"
      />
    </div>
  );
}

export type DueTimeScrollerProps = {
  /** ISO date or yyyy-MM-dd (time portion optional). */
  dueDate: string;
  onDueDateChange: (isoLocal: string) => void;
  className?: string;
};

/** Returns `yyyy-MM-dd'T'HH:mm:00` local-ish string for task due_at building. */
export function DueTimeScroller({ dueDate, onDueDateChange, className }: DueTimeScrollerProps) {
  const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i)), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);
  const ampm = ["AM", "PM"] as const;
  const [editing, setEditing] = useState<"hour" | "minute" | "ampm" | null>(null);

  const parsed = useMemo(() => {
    if (!dueDate) return new Date();
    try {
      if (dueDate.includes("T")) return parseISO(dueDate);
      return parseISO(`${dueDate}T09:00:00`);
    } catch {
      return new Date();
    }
  }, [dueDate]);

  const hour24 = parsed.getHours();
  const minute = parsed.getMinutes();
  const isPm = hour24 >= 12;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  const commit = (next: Date) => {
    const datePart = format(next, "yyyy-MM-dd");
    const timePart = format(next, "HH:mm");
    onDueDateChange(`${datePart}T${timePart}:00`);
  };

  const commitHourText = (raw: string) => {
    const n = Number.parseInt(raw.replace(/\D/g, ""), 10);
    if (!Number.isFinite(n) || n < 1 || n > 12) {
      setEditing(null);
      return;
    }
    let h24 = n % 12;
    if (isPm) h24 += 12;
    commit(setMinutes(setHours(parsed, h24), minute));
    setEditing(null);
  };

  const commitMinuteText = (raw: string) => {
    const n = Number.parseInt(raw.replace(/\D/g, ""), 10);
    if (!Number.isFinite(n) || n < 0 || n > 59) {
      setEditing(null);
      return;
    }
    commit(setMinutes(setHours(parsed, hour24), n));
    setEditing(null);
  };

  const commitAmpmText = (raw: string) => {
    const t = raw.trim().toUpperCase();
    const wantPm = t === "P" || t === "PM" || t.startsWith("P");
    const wantAm = t === "A" || t === "AM" || t.startsWith("A");
    if (!wantPm && !wantAm) {
      setEditing(null);
      return;
    }
    let h24 = hour12 % 12;
    if (wantPm) h24 += 12;
    commit(setMinutes(setHours(parsed, h24), minute));
    setEditing(null);
  };

  return (
    <div className={cn("flex flex-col items-center pt-2", className)}>
      {/* Match FillaMiniCalendar embedded caption: p-2 offset + h-[26px] row + mb-1 */}
      <div className="mb-1 flex h-[26px] w-[75px] items-center justify-center text-center text-base font-semibold text-foreground">
        Time
      </div>
      <div className="flex items-start gap-0.5">
        {editing === "hour" ? (
          <TimeTextField
            value={String(hour12)}
            width={32}
            inputMode="numeric"
            maxLength={2}
            onCommit={commitHourText}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <ScrollWheel
            values={hours}
            selectedIndex={hours.indexOf(hour12)}
            onSelect={(idx) => {
              const h12 = hours[idx];
              let h24 = h12 % 12;
              if (isPm) h24 += 12;
              commit(setMinutes(setHours(parsed, h24), minute));
            }}
            onRequestEdit={() => setEditing("hour")}
            formatValue={(v) => String(v)}
          />
        )}
        <span className="text-sm font-mono font-semibold text-muted-foreground w-1.5 pt-7">:</span>
        {editing === "minute" ? (
          <TimeTextField
            value={String(minute).padStart(2, "0")}
            width={32}
            inputMode="numeric"
            maxLength={2}
            onCommit={commitMinuteText}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <ScrollWheel
            values={minutes}
            selectedIndex={minute}
            onSelect={(idx) => commit(setMinutes(setHours(parsed, hour24), idx))}
            onRequestEdit={() => setEditing("minute")}
          />
        )}
        {editing === "ampm" ? (
          <TimeTextField
            value={isPm ? "PM" : "AM"}
            width={28}
            capsuleBg="bg-[rgba(142,201,206,1)]"
            textClassName="text-[10px] text-[rgba(246,244,242,1)]"
            maxLength={2}
            onCommit={commitAmpmText}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <ScrollWheel
            values={[...ampm]}
            selectedIndex={isPm ? 1 : 0}
            onSelect={(idx) => {
              const wantPm = idx === 1;
              let h24 = hour12 % 12;
              if (wantPm) h24 += 12;
              commit(setMinutes(setHours(parsed, h24), minute));
            }}
            onRequestEdit={() => setEditing("ampm")}
            formatValue={(v) => String(v)}
            width={28}
            capsuleBg="bg-[rgba(142,201,206,1)]"
            capsuleStyle={{ marginLeft: 2, marginRight: 2 }}
            textStyle={{ fontSize: 10, color: "rgba(246,244,242,1)" }}
          />
        )}
      </div>
    </div>
  );
}
