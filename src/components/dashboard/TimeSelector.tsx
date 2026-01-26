import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface TimeSelectorProps {
  hour: number;
  minute: number;
  onTimeChange: (hour: number, minute: number) => void;
  className?: string;
}

export function TimeSelector({
  hour,
  minute,
  onTimeChange,
  className,
}: TimeSelectorProps) {
  const hourScrollRef = useRef<HTMLDivElement | null>(null);
  const minuteScrollRef = useRef<HTMLDivElement | null>(null);
  const hourItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const minuteItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [hourScrollLeft, setHourScrollLeft] = useState(0);
  const [minuteScrollLeft, setMinuteScrollLeft] = useState(0);
  const [hourContainerWidth, setHourContainerWidth] = useState(0);
  const [minuteContainerWidth, setMinuteContainerWidth] = useState(0);
  const didInitHourScrollRef = useRef(false);
  const didInitMinuteScrollRef = useRef(false);

  // Generate hours (0-23) and minutes (0, 30)
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => [0, 30], []);

  // Calculate opacity based on distance from center for hours
  const getHourOpacity = (hourIndex: number) => {
    if (!hourScrollRef.current || hourContainerWidth === 0) return 1;

    const el = hourItemRefs.current[hourIndex];
    if (!el) return 1;

    const elRect = el.getBoundingClientRect();
    const containerRect = hourScrollRef.current.getBoundingClientRect();
    const elCenter = elRect.left + elRect.width / 2 - containerRect.left;
    const containerCenter = hourContainerWidth / 2;
    const distanceFromCenter = Math.abs(elCenter - containerCenter);

    const capsuleWidth = 35;
    const capsuleHalf = capsuleWidth / 2;

    if (distanceFromCenter <= capsuleHalf) {
      return 1;
    }

    const fadeStart = capsuleHalf;
    const fadeEnd = hourContainerWidth / 2;

    if (distanceFromCenter > fadeStart && distanceFromCenter < fadeEnd) {
      const fadeRange = fadeEnd - fadeStart;
      const fadeProgress = (distanceFromCenter - fadeStart) / fadeRange;
      return Math.max(0, 0.6 * (1 - fadeProgress));
    }

    if (distanceFromCenter >= fadeEnd) {
      return 0;
    }

    return 0.6;
  };

  // Calculate opacity based on distance from center for minutes
  const getMinuteOpacity = (minuteIndex: number) => {
    if (!minuteScrollRef.current || minuteContainerWidth === 0) return 1;

    const el = minuteItemRefs.current[minuteIndex];
    if (!el) return 1;

    const elRect = el.getBoundingClientRect();
    const containerRect = minuteScrollRef.current.getBoundingClientRect();
    const elCenter = elRect.left + elRect.width / 2 - containerRect.left;
    const containerCenter = minuteContainerWidth / 2;
    const distanceFromCenter = Math.abs(elCenter - containerCenter);

    const capsuleWidth = 35;
    const capsuleHalf = capsuleWidth / 2;

    if (distanceFromCenter <= capsuleHalf) {
      return 1;
    }

    const fadeStart = capsuleHalf;
    const fadeEnd = minuteContainerWidth / 2;

    if (distanceFromCenter > fadeStart && distanceFromCenter < fadeEnd) {
      const fadeRange = fadeEnd - fadeStart;
      const fadeProgress = (distanceFromCenter - fadeStart) / fadeRange;
      return Math.max(0, 0.6 * (1 - fadeProgress));
    }

    if (distanceFromCenter >= fadeEnd) {
      return 0;
    }

    return 0.6;
  };

  // Handle hour scroll
  const handleHourScroll = () => {
    const scroller = hourScrollRef.current;
    if (!scroller) return;

    const currentScrollLeft = scroller.scrollLeft;
    setHourScrollLeft(currentScrollLeft);
    setHourContainerWidth(scroller.clientWidth);

    const center = currentScrollLeft + scroller.clientWidth / 2;
    let closestIdx = 0;
    let minDist = Infinity;

    hourItemRefs.current.forEach((el, idx) => {
      if (!el) return;
      const elCenter = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(elCenter - center);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    });

    if (hours[closestIdx] !== undefined && hours[closestIdx] !== hour) {
      onTimeChange(hours[closestIdx], minute);
    }
  };

  // Handle minute scroll
  const handleMinuteScroll = () => {
    const scroller = minuteScrollRef.current;
    if (!scroller) return;

    const currentScrollLeft = scroller.scrollLeft;
    setMinuteScrollLeft(currentScrollLeft);
    setMinuteContainerWidth(scroller.clientWidth);

    const center = currentScrollLeft + scroller.clientWidth / 2;
    let closestIdx = 0;
    let minDist = Infinity;

    minuteItemRefs.current.forEach((el, idx) => {
      if (!el) return;
      const elCenter = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(elCenter - center);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    });

    if (minutes[closestIdx] !== undefined && minutes[closestIdx] !== minute) {
      onTimeChange(hour, minutes[closestIdx]);
    }
  };

  // Initialize scroll positions
  useEffect(() => {
    if (!didInitHourScrollRef.current && hourScrollRef.current) {
      const centerIndex = hour;
      const el = hourItemRefs.current[centerIndex];
      if (el) {
        el.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
        didInitHourScrollRef.current = true;
      }
    }
  }, [hours, hour]);

  useEffect(() => {
    if (!didInitMinuteScrollRef.current && minuteScrollRef.current) {
      const centerIndex = minutes.indexOf(minute);
      const el = minuteItemRefs.current[centerIndex];
      if (el) {
        el.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
        didInitMinuteScrollRef.current = true;
      }
    }
  }, [minutes, minute]);

  // Update container width and scroll position on mount and resize
  useEffect(() => {
    const updateDimensions = () => {
      if (hourScrollRef.current) {
        setHourContainerWidth(hourScrollRef.current.clientWidth);
        setHourScrollLeft(hourScrollRef.current.scrollLeft);
      }
      if (minuteScrollRef.current) {
        setMinuteContainerWidth(minuteScrollRef.current.clientWidth);
        setMinuteScrollLeft(minuteScrollRef.current.scrollLeft);
      }
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  return (
    <div className={cn("w-full", className)}>
      {/* Hours and Minutes selector */}
      <div className="relative">
        <div className="flex gap-4">
          {/* Hours selector */}
          <div className="flex-1 relative">
            <div
              ref={hourScrollRef}
              onScroll={handleHourScroll}
              className={cn(
                "overflow-x-auto no-scrollbar",
                "px-1 relative"
              )}
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {/* Muted overlay outside capsule */}
              <div
                className="absolute inset-0 pointer-events-none z-10"
                style={{
                  background: "unset",
                  backgroundColor: "unset",
                  backgroundImage: "none",
                }}
              />
              <div className="flex items-center gap-2 min-w-max py-1 relative z-0">
                {hours.map((h, idx) => {
                  const isActive = h === hour;
                  const opacity = getHourOpacity(idx);

                  return (
                    <button
                      key={h}
                      ref={(el) => (hourItemRefs.current[idx] = el)}
                      type="button"
                      onClick={() => {
                        onTimeChange(h, minute);
                        const el = hourItemRefs.current[idx];
                        if (el) {
                          el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
                        }
                      }}
                      className={cn(
                        "select-none",
                        "flex flex-col items-center justify-center",
                        "w-[35px] rounded-[14px] transition-all duration-200",
                        isActive ? "h-[60px]" : "h-14",
                        isActive
                          ? "bg-[rgba(233,230,226,1)] shadow-btn-pressed text-foreground"
                          : "bg-transparent text-muted-foreground"
                      )}
                      style={{
                        opacity: opacity,
                        transition: "opacity 0.2s ease-out",
                        position: "relative",
                        zIndex: 1,
                      }}
                    >
                      <span className="text-[10px] font-medium uppercase tracking-wide pb-[2px]">
                        H
                      </span>
                      <span className="relative flex items-center justify-center w-[30px] h-[30px] rounded-full">
                        <span className="relative z-10 text-sm font-mono font-normal text-[#2A293E]">
                          {h.toString().padStart(2, "0")}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Blur layer - covers everything, then capsule is cut out using mask */}
            <div
              className="absolute inset-0 pointer-events-none z-20"
              style={{
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
                maskImage: `linear-gradient(to right, black 0%, black calc(50% - 17.5px), transparent calc(50% - 17.5px), transparent calc(50% + 17.5px), black calc(50% + 17.5px), black 100%)`,
                WebkitMaskImage: `linear-gradient(to right, black 0%, black calc(50% - 17.5px), transparent calc(50% - 17.5px), transparent calc(50% + 17.5px), black calc(50% + 17.5px), black 100%)`,
              }}
            />

            {/* Crisp capsule window border */}
            <div
              className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[35px] pointer-events-none z-30"
              style={{
                borderRadius: "17.5px",
                background: "transparent",
                border: "0px",
                boxShadow: "inset 0px 12.5px 14.5px -7.8px rgba(0, 0, 0, 0.33), 0px -1px 1px 0px rgba(0, 0, 0, 0.25), 0px 1px 1px 0px rgba(255, 255, 255, 1)",
                height: "60px",
              }}
            />
          </div>

          {/* Minutes selector */}
          <div className="flex-1 relative">
            <div
              ref={minuteScrollRef}
              onScroll={handleMinuteScroll}
              className={cn(
                "overflow-x-auto no-scrollbar",
                "px-1 relative"
              )}
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch",
              }}
            >
              {/* Muted overlay outside capsule */}
              <div
                className="absolute inset-0 pointer-events-none z-10"
                style={{
                  background: "unset",
                  backgroundColor: "unset",
                  backgroundImage: "none",
                }}
              />
              <div className="flex items-center gap-2 min-w-max py-1 relative z-0 justify-center">
                {minutes.map((m, idx) => {
                  const isActive = m === minute;
                  const opacity = getMinuteOpacity(idx);

                  return (
                    <button
                      key={m}
                      ref={(el) => (minuteItemRefs.current[idx] = el)}
                      type="button"
                      onClick={() => {
                        onTimeChange(hour, m);
                        const el = minuteItemRefs.current[idx];
                        if (el) {
                          el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
                        }
                      }}
                      className={cn(
                        "select-none",
                        "flex flex-col items-center justify-center",
                        "w-[35px] rounded-[14px] transition-all duration-200",
                        isActive ? "h-[60px]" : "h-14",
                        isActive
                          ? "bg-[rgba(233,230,226,1)] shadow-btn-pressed text-foreground"
                          : "bg-transparent text-muted-foreground"
                      )}
                      style={{
                        opacity: opacity,
                        transition: "opacity 0.2s ease-out",
                        position: "relative",
                        zIndex: 1,
                      }}
                    >
                      <span className="text-[10px] font-medium uppercase tracking-wide pb-[2px]">
                        M
                      </span>
                      <span className="relative flex items-center justify-center w-[30px] h-[30px] rounded-full">
                        <span className="relative z-10 text-sm font-mono font-normal text-[#2A293E]">
                          {m.toString().padStart(2, "0")}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Blur layer - covers everything, then capsule is cut out using mask */}
            <div
              className="absolute inset-0 pointer-events-none z-20"
              style={{
                backdropFilter: "blur(4px)",
                WebkitBackdropFilter: "blur(4px)",
                maskImage: `linear-gradient(to right, black 0%, black calc(50% - 17.5px), transparent calc(50% - 17.5px), transparent calc(50% + 17.5px), black calc(50% + 17.5px), black 100%)`,
                WebkitMaskImage: `linear-gradient(to right, black 0%, black calc(50% - 17.5px), transparent calc(50% - 17.5px), transparent calc(50% + 17.5px), black calc(50% + 17.5px), black 100%)`,
              }}
            />

            {/* Crisp capsule window border */}
            <div
              className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[35px] pointer-events-none z-30"
              style={{
                borderRadius: "17.5px",
                background: "transparent",
                border: "0px",
                boxShadow: "inset 0px 12.5px 14.5px -7.8px rgba(0, 0, 0, 0.33), 0px -1px 1px 0px rgba(0, 0, 0, 0.25), 0px 1px 1px 0px rgba(255, 255, 255, 1)",
                height: "60px",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
