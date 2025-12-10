import React, { useState, useRef, useEffect } from 'react';
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

const filters = ['All', 'Tasks', 'Compliance', 'Reminders'];

export function CalendarHeatMap() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedFilter, setSelectedFilter] = useState('All');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const today = new Date().getDate();
  const currentDate = new Date();
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

  const isCurrentMonth = currentMonth.getMonth() === currentDate.getMonth() && 
                         currentMonth.getFullYear() === currentDate.getFullYear();

  const getHeatColor = (heat?: 'low' | 'medium' | 'high') => {
    switch (heat) {
      case 'low':
        return 'bg-primary/30';
      case 'medium':
        return 'bg-primary/50';
      case 'high':
        return 'bg-accent/40';
      default:
        return 'bg-white/10';
    }
  };

  const goToPrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  // Desktop swipe gesture handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (window.innerWidth < 1024) return;
    setIsDragging(true);
    setStartX(e.pageX);
    setScrollLeft(0);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const x = e.pageX;
    const walk = x - startX;
    setScrollLeft(walk);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (scrollLeft > 100) {
      goToPrevMonth();
    } else if (scrollLeft < -100) {
      goToNextMonth();
    }
    setScrollLeft(0);
  };

  // Mobile touch handlers with snap
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].pageX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const x = e.touches[0].pageX;
    setScrollLeft(x - startX);
  };

  const handleTouchEnd = () => {
    if (scrollLeft > 80) {
      goToPrevMonth();
    } else if (scrollLeft < -80) {
      goToNextMonth();
    }
    setScrollLeft(0);
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-semibold text-ink tracking-tight heading-l">Calendar Heat Map</h2>
        <p className="text-muted-foreground text-sm">Swipe to change months, heat circles indicate busyness</p>
      </div>

      {/* Dark Mode Calendar - Full width on mobile with equal padding */}
      <div 
        ref={scrollContainerRef}
        className="bg-sidebar-background rounded-[5px] shadow-e2 p-4 w-full max-w-md mx-auto touch-pan-x select-none overflow-hidden"
        style={{ 
          transform: scrollLeft !== 0 ? `translateX(${scrollLeft * 0.3}px)` : undefined,
          transition: scrollLeft === 0 ? 'transform 0.3s ease-out' : 'none'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header with navigation */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-sidebar-foreground text-xl">
            {currentMonth.toLocaleDateString('en-GB', {
              month: 'long',
              year: 'numeric'
            })}
          </h3>
          <div className="flex gap-1">
            <button 
              onClick={goToPrevMonth}
              className="p-1.5 rounded-[5px] transition-colors bg-sidebar-accent hover:bg-sidebar-accent/80"
            >
              <ChevronLeft className="w-5 h-5 text-sidebar-foreground" />
            </button>
            <button 
              onClick={goToNextMonth}
              className="p-1.5 rounded-[5px] transition-colors bg-sidebar-accent hover:bg-sidebar-accent/80"
            >
              <ChevronRight className="w-5 h-5 text-sidebar-foreground" />
            </button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {WEEKDAYS.map(day => (
            <div key={day} className="text-center font-mono text-[10px] uppercase tracking-wider text-sidebar-muted py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            const heat = day ? mockCalendarData[day] : undefined;
            const isToday = day === today && isCurrentMonth;
            return (
              <div
                key={i}
                className={cn(
                  'aspect-square rounded-full relative flex items-center justify-center',
                  'transition-all duration-200 cursor-pointer',
                  day ? getHeatColor(heat) : 'bg-transparent',
                  day && 'hover:ring-2 hover:ring-primary/40',
                  isToday && 'ring-2 ring-accent'
                )}
              >
                {day && (
                  <span className={cn(
                    'font-mono text-xs',
                    isToday ? 'text-accent font-bold' : 'text-sidebar-foreground'
                  )}>
                    {day}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter Chips below calendar */}
      <div className="flex gap-2 flex-wrap justify-center max-w-md mx-auto">
        {filters.map(filter => (
          <button
            key={filter}
            onClick={() => setSelectedFilter(filter)}
            className={cn(
              'px-3 py-1.5 rounded-[5px] font-mono text-[11px] uppercase tracking-wider transition-all shadow-e1',
              selectedFilter === filter
                ? 'bg-primary text-white'
                : 'bg-concrete/50 text-ink/70 hover:bg-concrete'
            )}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Heat level legend */}
      <div className="flex gap-6 text-sm justify-center">
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Heat Levels</p>
          <div className="flex gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-primary/30" />
              <span className="text-xs text-ink/70">Low</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-primary/50" />
              <span className="text-xs text-ink/70">Medium</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-accent/40" />
              <span className="text-xs text-ink/70">High</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
