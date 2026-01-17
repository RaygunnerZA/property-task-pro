import React from "react";
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
