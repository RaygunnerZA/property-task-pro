import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

// Mock data for heat levels only (no markers)
const mockCalendarData: Record<number, 'low' | 'medium' | 'high'> = {
  3: 'low',
  5: 'medium',
  8: 'high',
  12: 'medium',
  15: 'low',
  18: 'high',
  22: 'medium',
  25: 'low',
  28: 'high'
};
export function CalendarHeatMap() {
  const [currentMonth] = useState(new Date());
  const today = new Date().getDate();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  let startDayOfWeek = firstDay.getDay() - 1;
  if (startDayOfWeek < 0) startDayOfWeek = 6;
  const days: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  while (days.length % 7 !== 0) days.push(null);
  const getHeatColor = (heat?: 'low' | 'medium' | 'high') => {
    switch (heat) {
      case 'low':
        return 'bg-primary/20';
      case 'medium':
        return 'bg-primary/40';
      case 'high':
        return 'bg-accent/30';
      default:
        return 'bg-surface';
    }
  };
  return <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-semibold text-ink tracking-tight">Calendar Heat Map</h2>
        <p className="text-muted-foreground text-sm">Heat circles indicate busyness level</p>
      </div>

      <div className="bg-surface rounded-xl shadow-e2 p-4 w-full max-w-[320px] sm:max-w-md bg-[sidebar-primary-foreground] bg-foreground">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold bg-transparent text-signal-foreground text-xl">
            {currentMonth.toLocaleDateString('en-GB', {
            month: 'long',
            year: 'numeric'
          })}
          </h3>
          <div className="flex gap-1">
            <button className="p-1.5 rounded-lg transition-colors text-accent bg-primary-deep">
              <ChevronLeft className="w-5 h-5 text-secondary-foreground" />
            </button>
            <button className="p-1.5 rounded-lg transition-colors bg-primary-deep text-signal-foreground">
              <ChevronRight className="w-5 h-5 text-ink/60" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map(day => <div key={day} className="text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground py-1">
              {day}
            </div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
          const heat = day ? mockCalendarData[day] : undefined;
          const isToday = day === today;
          return <div key={i} className={cn('aspect-square rounded-full relative flex items-center justify-center', 'transition-all duration-200 cursor-pointer', day ? getHeatColor(heat) : 'bg-transparent', day && 'hover:ring-2 hover:ring-primary/30', isToday && 'ring-2 ring-accent')}>
                {day && <span className={cn('font-mono text-xs', isToday ? 'text-accent font-bold' : 'text-ink/80')}>
                    {day}
                  </span>}
              </div>;
        })}
        </div>
      </div>

      <div className="flex gap-6 text-sm">
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Heat Levels</p>
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-primary/20" />
              <span className="text-xs text-ink/70">Low</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-primary/40" />
              <span className="text-xs text-ink/70">Medium</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-accent/30" />
              <span className="text-xs text-ink/70">High</span>
            </div>
          </div>
        </div>
      </div>
    </section>;
}