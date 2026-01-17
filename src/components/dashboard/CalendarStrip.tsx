import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, format, isSameDay, subDays } from "date-fns";
import { cn } from "@/lib/utils";

type StripMode = "browse" | "schedule";

interface CalendarStripProps {
  activeDate: Date;
  mode?: StripMode;
  onActiveDateChange: (date: Date) => void;
  onDatePress?: (date: Date) => void;
  rangeDays?: number;
  tasksByDate?: Map<string, {
    total: number;
    high: number;
    urgent: number;
    overdue: number;
  }>;
  className?: string;
}

export function CalendarStrip({
  activeDate,
  mode = "browse",
  onActiveDateChange,
  onDatePress,
  rangeDays = 90,
  tasksByDate,
  className,
}: CalendarStripProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);
  const didInitScrollRef = useRef(false);
  const scrollEndTimeoutRef = useRef<number | null>(null);
  const pendingCenterIndexRef = useRef<number | null>(null);
  const lastInteractionRef = useRef<"scroll" | "click" | null>(null);
  const [anchorDate, setAnchorDate] = useState(activeDate);

  useEffect(() => {
    if (mode === "schedule") {
      setAnchorDate(activeDate);
    }
  }, [activeDate, mode]);

  const days = useMemo(() => {
    const start = subDays(anchorDate, rangeDays);
    const total = rangeDays * 2 + 1;
    return Array.from({ length: total }, (_, i) => addDays(start, i));
  }, [anchorDate, rangeDays]);

  useEffect(() => {
    if (didInitScrollRef.current) return;
    const centerIndex = rangeDays;
    const el = itemRefs.current[centerIndex];
    if (el) {
      el.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
      didInitScrollRef.current = true;
    }
  }, [days, rangeDays]);

  useEffect(() => {
    if (mode !== "schedule" || lastInteractionRef.current !== "click") return;
    const centerIndex = rangeDays;
    const el = itemRefs.current[centerIndex];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
    lastInteractionRef.current = null;
  }, [activeDate, mode, rangeDays]);

  const handleScroll = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const scroller = scrollRef.current;
      if (!scroller) return;

      const center = scroller.scrollLeft + scroller.clientWidth / 2;
      let closestIdx = 0;
      let minDist = Infinity;

      itemRefs.current.forEach((el, idx) => {
        if (!el) return;
        const elCenter = el.offsetLeft + el.offsetWidth / 2;
        const dist = Math.abs(elCenter - center);
        if (dist < minDist) {
          minDist = dist;
          closestIdx = idx;
        }
      });

      const candidate = days[closestIdx];
      if (candidate && !isSameDay(candidate, activeDate)) {
        lastInteractionRef.current = "scroll";
        onActiveDateChange(candidate);
      }

      pendingCenterIndexRef.current = closestIdx;
      if (scrollEndTimeoutRef.current) {
        window.clearTimeout(scrollEndTimeoutRef.current);
      }
      scrollEndTimeoutRef.current = window.setTimeout(() => {
        if (mode !== "schedule") return;
        const idx = pendingCenterIndexRef.current;
        const el = typeof idx === "number" ? itemRefs.current[idx] : null;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
        }
      }, 140);
    });
  };

  return (
    <div className={cn("w-full", className)}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn(
          "overflow-x-auto scrollbar-hide",
          "px-1"
        )}
      >
        <div className="flex items-center gap-2 min-w-max py-1">
          {days.map((day, idx) => {
            const isActive = isSameDay(day, activeDate);
            const isToday = isSameDay(day, new Date());
            const dateKey = format(day, "yyyy-MM-dd");
            const dateData = tasksByDate?.get(dateKey);
            const taskCount = dateData?.total || 0;
            const highCount = dateData?.high || 0;
            const urgentCount = dateData?.urgent || 0;
            const overdueCount = dateData?.overdue || 0;
            const hasTasks = taskCount > 0;

            let fillColor = "";
            if (hasTasks) {
              const totalUrgentOrOverdue = urgentCount + overdueCount;
              if (totalUrgentOrOverdue >= 3) {
                fillColor = "rgba(220, 38, 38, 0.6)";
              } else if (highCount >= 3) {
                fillColor = "rgba(245, 138, 48, 0.6)";
              } else if (totalUrgentOrOverdue >= 1 || highCount >= 1) {
                fillColor = totalUrgentOrOverdue > 0
                  ? "rgba(220, 38, 38, 0.4)"
                  : "rgba(245, 138, 48, 0.4)";
              } else {
                if (taskCount >= 4) {
                  fillColor = "rgba(78, 179, 182, 0.6)";
                } else if (taskCount >= 2) {
                  fillColor = "rgba(78, 179, 182, 0.5)";
                } else {
                  fillColor = "rgba(78, 179, 182, 0.4)";
                }
              }
            } else if (isToday) {
              fillColor = "#ffffff";
            }

            return (
              <button
                key={day.toISOString()}
                ref={(el) => (itemRefs.current[idx] = el)}
                type="button"
                onClick={() => {
                  lastInteractionRef.current = "click";
                  onDatePress?.(day);
                }}
                className={cn(
                  "select-none",
                  "flex flex-col items-center justify-center",
                  "w-[35px] rounded-[14px] transition-all duration-200",
                  mode === "schedule" && isActive ? "h-[60px]" : "h-14",
                  mode === "schedule" && isActive
                    ? "bg-[rgba(233,230,226,1)] shadow-btn-pressed text-foreground"
                    : "bg-transparent text-muted-foreground",
                  isToday && !isActive && "text-foreground"
                )}
              >
                <span className="text-[10px] font-medium uppercase tracking-wide pb-[2px]">
                  {format(day, "EE")}
                </span>
                <span
                  className="relative flex items-center justify-center w-[30px] h-[30px] rounded-full"
                  style={{
                    backgroundColor: mode === "schedule" && isActive
                      ? "transparent"
                      : (fillColor || "transparent"),
                    boxShadow: hasTasks
                      ? "inset -1px -2px 2px 0px rgba(255, 255, 255, 0.41), inset 3px 3px 4px 0px rgba(0, 0, 0, 0.17)"
                      : undefined,
                  }}
                >
                  <span className="relative z-10 text-sm font-mono font-normal text-[#2A293E]">
                    {format(day, "d")}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
