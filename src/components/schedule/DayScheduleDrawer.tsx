import React, { useEffect } from "react";
import { ScheduleItemBase } from "@/types/schedule";
import { ScheduleItemCard } from "./ScheduleItemCard";

interface DayScheduleDrawerProps {
  dateLabel: string;
  items: ScheduleItemBase[];
  onItemPress?: (item: ScheduleItemBase) => void;
}

/**
 * DayScheduleDrawer
 * - Appears under Month View
 * - Shows all items for selected day
 * - Tactile, floating, calm "drawer" feel
 */

export const DayScheduleDrawer: React.FC<DayScheduleDrawerProps> = ({
  dateLabel,
  items,
  onItemPress,
}) => {
  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'D',location:'DayScheduleDrawer.tsx:18',message:'DayScheduleDrawer render',data:{dateLabel,itemsCount:items.length,items:items.map(i=>({id:i.id,kind:i.kind,date:i.date,title:i.title}))},timestamp:Date.now()})}).catch(()=>{});
  }, [dateLabel, items]);
  // #endregion
  const countLabel =
    items.length === 0
      ? "No items"
      : items.length === 1
      ? "1 item"
      : `${items.length} items`;

  return (
    <section className="mt-3 px-4 py-4 rounded-2xl bg-card shadow-e2 transition-all duration-150">
      {/* HEADER */}
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold">{dateLabel}</h2>
        <span className="text-xs text-muted-foreground">{countLabel}</span>
      </div>

      {/* LIST */}
      <div className="space-y-2">
        {items.length > 0 ? (
          items.map((item) => (
            <ScheduleItemCard
              key={`${item.kind}-${item.id}`}
              item={item}
              onPress={onItemPress}
            />
          ))
        ) : (
          <div className="py-6 text-center text-xs text-muted-foreground opacity-70">
            Nothing scheduled for this day.
          </div>
        )}
      </div>
    </section>
  );
};
