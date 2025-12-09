import React, { useState, useMemo } from 'react';
import { Copy, Check, RotateCcw, ChevronLeft, ChevronRight, Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

interface CalendarConfig {
  titleFontSize: number;
  titleFontFamily: 'sans' | 'mono';
  titleColor: string;
  weekdayFontSize: number;
  weekdayFontFamily: 'sans' | 'mono';
  weekdayColor: string;
  dateFontSize: number;
  dateFontFamily: 'sans' | 'mono';
  dateColor: string;
  cellSize: number;
  cellPadding: number;
  cellGap: number;
  heatLow: string;
  heatMedium: string;
  heatHigh: string;
  borderRadius: number;
  cardBackground: string;
  isDarkMode: boolean;
}

const defaultConfig: CalendarConfig = {
  titleFontSize: 18,
  titleFontFamily: 'sans',
  titleColor: '#2C2C2C',
  weekdayFontSize: 10,
  weekdayFontFamily: 'mono',
  weekdayColor: '#666666',
  dateFontSize: 12,
  dateFontFamily: 'mono',
  dateColor: '#2C2C2C',
  cellSize: 36,
  cellPadding: 4,
  cellGap: 4,
  heatLow: '#8EC9CE33',
  heatMedium: '#8EC9CE66',
  heatHigh: '#EB683450',
  borderRadius: 50,
  cardBackground: '#F1EEE8',
  isDarkMode: false,
};

const darkModeConfig: Partial<CalendarConfig> = {
  titleColor: '#FFFFFF',
  weekdayColor: '#AAAAAA',
  dateColor: '#FFFFFF',
  cardBackground: '#2C2C2C',
  isDarkMode: true,
};

// Mock heat data
const mockHeat: Record<number, 'low' | 'medium' | 'high'> = {
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

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className="font-mono text-[10px] text-ink">{value}</span>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        step={step} 
        value={value} 
        onChange={e => onChange(Number(e.target.value))} 
        className="w-full h-1.5 bg-concrete rounded-full appearance-none cursor-pointer accent-primary" 
      />
    </div>
  );
}

export function CalendarSandbox() {
  const [config, setConfig] = useState<CalendarConfig>(defaultConfig);
  const [copied, setCopied] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [currentMonth] = useState(new Date());
  const today = new Date().getDate();

  // Generate calendar days
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
      case 'low': return config.heatLow;
      case 'medium': return config.heatMedium;
      case 'high': return config.heatHigh;
      default: return 'transparent';
    }
  };

  const update = <K extends keyof CalendarConfig>(key: K, value: CalendarConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const toggleDarkMode = () => {
    if (config.isDarkMode) {
      setConfig({ ...defaultConfig, isDarkMode: false });
    } else {
      setConfig(prev => ({ ...prev, ...darkModeConfig }));
    }
  };

  const reset = () => setConfig(defaultConfig);

  const commitStyles = () => {
    localStorage.setItem('filla-committed-calendar-styles', JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('filla-calendar-styles-updated', { detail: config }));
    setCommitted(true);
    setTimeout(() => setCommitted(false), 2000);
  };

  const cssOutput = useMemo(() => `/* Calendar Styles */
.calendar-card {
  background-color: ${config.cardBackground};
}

.calendar-title {
  font-size: ${config.titleFontSize}px;
  font-family: ${config.titleFontFamily === 'mono' ? "'JetBrains Mono', monospace" : "'Inter Tight', sans-serif"};
  color: ${config.titleColor};
}

.calendar-weekday {
  font-size: ${config.weekdayFontSize}px;
  font-family: ${config.weekdayFontFamily === 'mono' ? "'JetBrains Mono', monospace" : "'Inter Tight', sans-serif"};
  color: ${config.weekdayColor};
}

.calendar-date {
  font-size: ${config.dateFontSize}px;
  font-family: ${config.dateFontFamily === 'mono' ? "'JetBrains Mono', monospace" : "'Inter Tight', sans-serif"};
  color: ${config.dateColor};
  width: ${config.cellSize}px;
  height: ${config.cellSize}px;
  border-radius: ${config.borderRadius}%;
}

.heat-low { background-color: ${config.heatLow}; }
.heat-medium { background-color: ${config.heatMedium}; }
.heat-high { background-color: ${config.heatHigh}; }`, [config]);

  const copyCSS = () => {
    navigator.clipboard.writeText(cssOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-semibold text-ink tracking-tight">Calendar Sandbox</h2>
        <p className="text-muted-foreground text-sm">Customize calendar heat map appearance with live preview</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Preview */}
        <div className="space-y-4">
          {/* Dark Mode Toggle */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Preview Mode</span>
            <button
              onClick={toggleDarkMode}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wider transition-all',
                config.isDarkMode ? 'bg-ink text-white' : 'bg-surface/80 shadow-e1 text-ink'
              )}
            >
              {config.isDarkMode ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
              {config.isDarkMode ? 'Dark' : 'Light'}
            </button>
          </div>

          <div 
            className="rounded-xl shadow-e2 p-4 inline-block w-full max-w-xs sm:max-w-sm"
            style={{ backgroundColor: config.cardBackground }}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 
                className="font-semibold" 
                style={{
                  fontSize: config.titleFontSize,
                  fontFamily: config.titleFontFamily === 'mono' ? "'JetBrains Mono', monospace" : "'Inter Tight', sans-serif",
                  color: config.titleColor,
                }}
              >
                {currentMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </h3>
              <div className="flex gap-1">
                <button className="p-1.5 rounded-lg hover:bg-concrete/50 transition-colors">
                  <ChevronLeft className="w-5 h-5" style={{ color: config.titleColor }} />
                </button>
                <button className="p-1.5 rounded-lg hover:bg-concrete/50 transition-colors">
                  <ChevronRight className="w-5 h-5" style={{ color: config.titleColor }} />
                </button>
              </div>
            </div>

            {/* Weekday Headers */}
            <div className="grid grid-cols-7 mb-2" style={{ gap: config.cellGap }}>
              {WEEKDAYS.map(day => (
                <div 
                  key={day} 
                  className="text-center uppercase tracking-wider" 
                  style={{
                    fontSize: config.weekdayFontSize,
                    fontFamily: config.weekdayFontFamily === 'mono' ? "'JetBrains Mono', monospace" : "'Inter Tight', sans-serif",
                    color: config.weekdayColor,
                    width: config.cellSize,
                    padding: `${config.cellPadding}px 0`
                  }}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7" style={{ gap: config.cellGap }}>
              {days.map((day, i) => {
                const heat = day ? mockHeat[day] : undefined;
                const isToday = day === today;
                return (
                  <div 
                    key={i} 
                    className={cn(
                      'flex items-center justify-center transition-all duration-200 cursor-pointer',
                      day && 'hover:ring-2 hover:ring-primary/30',
                      isToday && 'ring-2 ring-accent'
                    )} 
                    style={{
                      width: config.cellSize,
                      height: config.cellSize,
                      borderRadius: `${config.borderRadius}%`,
                      backgroundColor: day ? getHeatColor(heat) : 'transparent',
                      padding: config.cellPadding
                    }}
                  >
                    {day && (
                      <span 
                        className={cn(isToday && 'font-bold')} 
                        style={{
                          fontSize: config.dateFontSize,
                          fontFamily: config.dateFontFamily === 'mono' ? "'JetBrains Mono', monospace" : "'Inter Tight', sans-serif",
                          color: isToday ? '#EB6834' : config.dateColor,
                        }}
                      >
                        {day}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Heat Legend */}
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: config.heatLow }} />
              <span className="text-xs text-ink/70">Low</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: config.heatMedium }} />
              <span className="text-xs text-ink/70">Medium</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: config.heatHigh }} />
              <span className="text-xs text-ink/70">High</span>
            </div>
          </div>

          {/* CSS Output */}
          <div className="bg-ink rounded-lg p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/60">CSS Output</span>
              <div className="flex gap-2">
                <button onClick={reset} className="p-1.5 rounded hover:bg-white/10 transition-colors" title="Reset">
                  <RotateCcw className="w-4 h-4 text-white/60" />
                </button>
                <button onClick={copyCSS} className="p-1.5 rounded hover:bg-white/10 transition-colors" title="Copy">
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white/60" />}
                </button>
              </div>
            </div>
            <pre className="text-xs text-primary font-mono overflow-x-auto whitespace-pre-wrap">{cssOutput}</pre>
          </div>

          {/* Commit Button */}
          <button
            onClick={commitStyles}
            className="w-full py-3 rounded-lg font-mono text-sm uppercase tracking-wider font-medium transition-all bg-primary text-white hover:bg-primary-deep shadow-e1"
          >
            {committed ? (
              <span className="flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> Styles Committed
              </span>
            ) : (
              'Commit & Apply Calendar Styles'
            )}
          </button>
        </div>

        {/* Controls */}
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
          {/* Card Background */}
          <div className="bg-surface/50 rounded-lg shadow-e1 p-3 sm:p-4 space-y-4">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Card</h3>
            <div className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Background</span>
              <input
                type="color"
                value={config.cardBackground}
                onChange={(e) => update('cardBackground', e.target.value)}
                className="w-full h-8 rounded cursor-pointer"
              />
            </div>
          </div>

          {/* Title */}
          <div className="bg-surface/50 rounded-lg shadow-e1 p-3 sm:p-4 space-y-4">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Title</h3>
            <div className="grid grid-cols-2 gap-4">
              <Slider label="Font Size" value={config.titleFontSize} min={12} max={28} onChange={v => update('titleFontSize', v)} />
              <div className="space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Font</span>
                <select 
                  value={config.titleFontFamily} 
                  onChange={e => update('titleFontFamily', e.target.value as 'sans' | 'mono')} 
                  className="w-full h-8 rounded border border-concrete bg-background px-2 text-xs"
                >
                  <option value="sans">Inter Tight</option>
                  <option value="mono">JetBrains Mono</option>
                </select>
              </div>
              <div className="space-y-1 col-span-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Color</span>
                <input
                  type="color"
                  value={config.titleColor}
                  onChange={(e) => update('titleColor', e.target.value)}
                  className="w-full h-8 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Weekdays */}
          <div className="bg-surface/50 rounded-lg shadow-e1 p-3 sm:p-4 space-y-4">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Weekdays</h3>
            <div className="grid grid-cols-2 gap-4">
              <Slider label="Font Size" value={config.weekdayFontSize} min={8} max={16} onChange={v => update('weekdayFontSize', v)} />
              <div className="space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Font</span>
                <select 
                  value={config.weekdayFontFamily} 
                  onChange={e => update('weekdayFontFamily', e.target.value as 'sans' | 'mono')} 
                  className="w-full h-8 rounded border border-concrete bg-background px-2 text-xs"
                >
                  <option value="sans">Inter Tight</option>
                  <option value="mono">JetBrains Mono</option>
                </select>
              </div>
              <div className="space-y-1 col-span-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Color</span>
                <input
                  type="color"
                  value={config.weekdayColor}
                  onChange={(e) => update('weekdayColor', e.target.value)}
                  className="w-full h-8 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="bg-surface/50 rounded-lg shadow-e1 p-3 sm:p-4 space-y-4">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Dates</h3>
            <div className="grid grid-cols-2 gap-4">
              <Slider label="Font Size" value={config.dateFontSize} min={10} max={18} onChange={v => update('dateFontSize', v)} />
              <div className="space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Font</span>
                <select 
                  value={config.dateFontFamily} 
                  onChange={e => update('dateFontFamily', e.target.value as 'sans' | 'mono')} 
                  className="w-full h-8 rounded border border-concrete bg-background px-2 text-xs"
                >
                  <option value="sans">Inter Tight</option>
                  <option value="mono">JetBrains Mono</option>
                </select>
              </div>
              <div className="space-y-1 col-span-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Color</span>
                <input
                  type="color"
                  value={config.dateColor}
                  onChange={(e) => update('dateColor', e.target.value)}
                  className="w-full h-8 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Cell Sizing */}
          <div className="bg-surface/50 rounded-lg shadow-e1 p-3 sm:p-4 space-y-4">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Cell Layout</h3>
            <div className="grid grid-cols-2 gap-4">
              <Slider label="Cell Size" value={config.cellSize} min={28} max={56} onChange={v => update('cellSize', v)} />
              <Slider label="Cell Gap" value={config.cellGap} min={0} max={12} onChange={v => update('cellGap', v)} />
              <Slider label="Padding" value={config.cellPadding} min={0} max={12} onChange={v => update('cellPadding', v)} />
              <Slider label="Roundness" value={config.borderRadius} min={0} max={50} onChange={v => update('borderRadius', v)} />
            </div>
          </div>

          {/* Heat Colors */}
          <div className="bg-surface/50 rounded-lg shadow-e1 p-3 sm:p-4 space-y-4">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Heat Colors</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Low</span>
                <input 
                  type="color" 
                  value={config.heatLow.slice(0, 7)} 
                  onChange={e => update('heatLow', e.target.value + '33')} 
                  className="w-full h-8 rounded cursor-pointer" 
                />
              </div>
              <div className="space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Medium</span>
                <input 
                  type="color" 
                  value={config.heatMedium.slice(0, 7)} 
                  onChange={e => update('heatMedium', e.target.value + '66')} 
                  className="w-full h-8 rounded cursor-pointer" 
                />
              </div>
              <div className="space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">High</span>
                <input 
                  type="color" 
                  value={config.heatHigh.slice(0, 7)} 
                  onChange={e => update('heatHigh', e.target.value + '50')} 
                  className="w-full h-8 rounded cursor-pointer" 
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}