import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

// Mock data for heat levels and markers
const mockCalendarData: Record<number, { heat: 'low' | 'medium' | 'high'; tasks: { low: number; normal: number; high: number }; compliance: { low: number; normal: number; high: number } }> = {
  3: { heat: 'low', tasks: { low: 1, normal: 0, high: 0 }, compliance: { low: 1, normal: 0, high: 0 } },
  5: { heat: 'medium', tasks: { low: 1, normal: 2, high: 0 }, compliance: { low: 0, normal: 1, high: 0 } },
  8: { heat: 'high', tasks: { low: 0, normal: 1, high: 2 }, compliance: { low: 0, normal: 0, high: 1 } },
  12: { heat: 'medium', tasks: { low: 2, normal: 1, high: 0 }, compliance: { low: 0, normal: 0, high: 0 } },
  15: { heat: 'low', tasks: { low: 1, normal: 0, high: 0 }, compliance: { low: 0, normal: 0, high: 0 } },
  18: { heat: 'high', tasks: { low: 0, normal: 0, high: 3 }, compliance: { low: 0, normal: 1, high: 1 } },
  22: { heat: 'medium', tasks: { low: 1, normal: 2, high: 1 }, compliance: { low: 1, normal: 0, high: 0 } },
  25: { heat: 'low', tasks: { low: 2, normal: 0, high: 0 }, compliance: { low: 0, normal: 0, high: 0 } },
  28: { heat: 'high', tasks: { low: 0, normal: 1, high: 2 }, compliance: { low: 0, normal: 0, high: 1 } },
};

function TaskMarkers({ tasks }: { tasks: { low: number; normal: number; high: number } }) {
  const markers = [];
  if (tasks.low > 0) markers.push({ color: 'bg-white border border-concrete', count: tasks.low });
  if (tasks.normal > 0) markers.push({ color: 'bg-primary', count: tasks.normal });
  if (tasks.high > 0) markers.push({ color: 'bg-accent', count: tasks.high });

  if (markers.length === 0) return null;

  return (
    <div className="absolute bottom-1 left-1 flex flex-col-reverse gap-0.5">
      {markers.map((marker, i) => (
        <div
          key={i}
          className={cn(
            'rounded-full',
            marker.color,
            marker.count > 1 ? 'w-1.5 h-3' : 'w-1.5 h-1.5'
          )}
        />
      ))}
    </div>
  );
}

function ComplianceMarkers({ compliance }: { compliance: { low: number; normal: number; high: number } }) {
  const markers = [];
  if (compliance.low > 0) markers.push('bg-white border border-concrete');
  if (compliance.normal > 0) markers.push('bg-primary');
  if (compliance.high > 0) markers.push('bg-accent');

  if (markers.length === 0) return null;

  return (
    <div className="absolute top-1 right-1 flex flex-col gap-0.5">
      {markers.map((color, i) => (
        <div
          key={i}
          className={cn('w-1 h-2 rounded-t-sm', color)}
          style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)' }}
        />
      ))}
    </div>
  );
}

export function CalendarHeatMap() {
  const [currentMonth] = useState(new Date());
  const today = new Date().getDate();

  // Generate calendar days
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  
  // Adjust for Monday start (0 = Monday, 6 = Sunday)
  let startDayOfWeek = firstDay.getDay() - 1;
  if (startDayOfWeek < 0) startDayOfWeek = 6;

  const days: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  while (days.length % 7 !== 0) days.push(null);

  const getHeatColor = (heat?: 'low' | 'medium' | 'high') => {
    switch (heat) {
      case 'low': return 'bg-primary/20';
      case 'medium': return 'bg-primary/40';
      case 'high': return 'bg-accent/30';
      default: return 'bg-surface';
    }
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-semibold text-ink tracking-tight">Calendar Heat Map</h2>
        <p className="text-muted-foreground text-sm">Heat circles indicate busyness, with task and compliance markers</p>
      </div>

      <div className="bg-surface rounded-xl shadow-e2 p-4 max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold text-ink">
            {currentMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </h3>
          <div className="flex gap-1">
            <button className="p-1.5 rounded-lg hover:bg-concrete/50 transition-colors">
              <ChevronLeft className="w-5 h-5 text-ink/60" />
            </button>
            <button className="p-1.5 rounded-lg hover:bg-concrete/50 transition-colors">
              <ChevronRight className="w-5 h-5 text-ink/60" />
            </button>
          </div>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map((day) => (
            <div key={day} className="text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            const data = day ? mockCalendarData[day] : undefined;
            const isToday = day === today;

            return (
              <div
                key={i}
                className={cn(
                  'aspect-square rounded-full relative flex items-center justify-center',
                  'transition-all duration-200 cursor-pointer',
                  day ? getHeatColor(data?.heat) : 'bg-transparent',
                  day && 'hover:ring-2 hover:ring-primary/30',
                  isToday && 'ring-2 ring-accent'
                )}
              >
                {day && (
                  <>
                    <span className={cn(
                      'font-mono text-xs',
                      isToday ? 'text-accent font-bold' : 'text-ink/80'
                    )}>
                      {day}
                    </span>
                    {data?.tasks && <TaskMarkers tasks={data.tasks} />}
                    {data?.compliance && <ComplianceMarkers compliance={data.compliance} />}
                    {isToday && (
                      <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-6 text-sm">
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

        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Task Markers (bottom-left)</p>
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-white border border-concrete" />
              <span className="text-xs text-ink/70">Low</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-xs text-ink/70">Normal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span className="text-xs text-ink/70">High</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Compliance Flags (top-right)</p>
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-2 bg-white border border-concrete rounded-t-sm" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)' }} />
              <span className="text-xs text-ink/70">Low</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-2 bg-primary rounded-t-sm" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)' }} />
              <span className="text-xs text-ink/70">Normal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-2 bg-accent rounded-t-sm" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%)' }} />
              <span className="text-xs text-ink/70">High</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
