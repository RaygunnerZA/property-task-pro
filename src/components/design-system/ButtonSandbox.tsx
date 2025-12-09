import React, { useState, useMemo } from 'react';
import { Copy, Check, RotateCcw, Plus, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ButtonType = 'primary' | 'secondary' | 'ghost' | 'danger';
type ChipType = 'filter' | 'status' | 'priority';

interface ButtonStyle {
  shadow: string;
  shadowPressed: string;
  borderRadius: number;
  backgroundColor: string;
  textColor: string;
}

interface ChipStyle {
  backgroundColor: string;
  textColor: string;
  borderRadius: number;
}

interface FilterChipStyle {
  activeBackgroundColor: string;
  activeTextColor: string;
  inactiveBackgroundColor: string;
  inactiveTextColor: string;
  borderRadius: number;
  shadow: string;
}

interface SegmentedControlStyle {
  trackBackgroundColor: string;
  trackBorderRadius: number;
  trackShadow: string;
  buttonBackgroundColor: string;
  buttonTextColor: string;
  buttonBorderRadius: number;
  buttonShadow: string;
  activeButtonBackgroundColor: string;
  activeButtonTextColor: string;
}

const defaultButtonStyles: Record<ButtonType, ButtonStyle> = {
  primary: {
    shadow: '3px 5px 7px 2px rgba(0, 0, 0, 0.06), -4px -5px 11px 4px rgba(255, 255, 255, 0.52), inset 2px 2px 0px 0px rgba(255, 255, 255, 0), inset -2px -3px 4px 0px rgba(0, 0, 0, 0.06)',
    shadowPressed: '0px 0px 7px 2px rgba(0, 0, 0, 0.01), inset -3px -9px 17px 0px rgba(255, 255, 255, 0.49), inset 1px 13px 19px 0px rgba(0, 0, 0, 0.09)',
    borderRadius: 10,
    backgroundColor: '#8EC9CE',
    textColor: '#FFFFFF',
  },
  secondary: {
    shadow: '2px 6px 5px -3px rgba(0, 0, 0, 0.07), -2px -2px 8px -3px rgba(255, 255, 255, 0.19), inset 0px -2px 2px 0px rgba(0, 0, 0, 0.1), inset 1px 2px 2px 0px rgba(255, 255, 255, 1)',
    shadowPressed: '3px 4px 3px -3px rgba(255, 255, 255, 1), -2px -2px 5px -3px rgba(0, 0, 0, 0.05), inset -3px -3px 2px 0px rgba(0, 0, 0, 0.01), inset 1px 2px 2px 0px rgba(0, 0, 0, 0.08)',
    borderRadius: 10,
    backgroundColor: '#F1EEE8',
    textColor: '#2C2C2C',
  },
  ghost: {
    shadow: 'none',
    shadowPressed: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
    borderRadius: 10,
    backgroundColor: 'transparent',
    textColor: '#2C2C2C',
  },
  danger: {
    shadow: '2px 4px 8px -2px rgba(239, 68, 68, 0.3), -2px -2px 6px -2px rgba(255, 255, 255, 0.4)',
    shadowPressed: 'inset 0 2px 6px rgba(239, 68, 68, 0.2)',
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    textColor: '#DC2626',
  },
};

const defaultChipStyles: Record<ChipType, ChipStyle> = {
  filter: {
    backgroundColor: '#8EC9CE',
    textColor: '#FFFFFF',
    borderRadius: 50,
  },
  status: {
    backgroundColor: '#22C55E33',
    textColor: '#166534',
    borderRadius: 50,
  },
  priority: {
    backgroundColor: '#EB683450',
    textColor: '#C2410C',
    borderRadius: 4,
  },
};

const defaultFilterChipStyle: FilterChipStyle = {
  activeBackgroundColor: '#8EC9CE',
  activeTextColor: '#FFFFFF',
  inactiveBackgroundColor: '#F1EEE8',
  inactiveTextColor: '#6F6F6F',
  borderRadius: 50,
  shadow: '2px 3px 5px -2px rgba(0, 0, 0, 0.08), -2px -2px 5px -2px rgba(255, 255, 255, 0.6), inset 0px -1px 1px 0px rgba(0, 0, 0, 0.05)',
};

const defaultSegmentedControlStyle: SegmentedControlStyle = {
  trackBackgroundColor: '#E8E5DF',
  trackBorderRadius: 10,
  trackShadow: 'inset 2px 2px 4px rgba(0, 0, 0, 0.1), inset -2px -2px 4px rgba(255, 255, 255, 0.7)',
  buttonBackgroundColor: 'transparent',
  buttonTextColor: '#6F6F6F',
  buttonBorderRadius: 8,
  buttonShadow: 'none',
  activeButtonBackgroundColor: '#FFFFFF',
  activeButtonTextColor: '#1A1A1A',
};

interface ShadowLayer {
  enabled: boolean;
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
  opacity: number;
  inset: boolean;
}

function parseShadow(shadowString: string): ShadowLayer[] {
  if (!shadowString || shadowString === 'none') return [];
  
  const layers: ShadowLayer[] = [];
  const regex = /(inset\s+)?(-?\d+)px\s+(-?\d+)px\s+(-?\d+)px\s+(-?\d+)px\s+rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/g;
  let match;
  
  while ((match = regex.exec(shadowString)) !== null) {
    layers.push({
      enabled: true,
      inset: !!match[1],
      x: parseInt(match[2]),
      y: parseInt(match[3]),
      blur: parseInt(match[4]),
      spread: parseInt(match[5]),
      color: `#${parseInt(match[6]).toString(16).padStart(2, '0')}${parseInt(match[7]).toString(16).padStart(2, '0')}${parseInt(match[8]).toString(16).padStart(2, '0')}`,
      opacity: parseFloat(match[9]),
    });
  }
  
  return layers;
}

function layersToCSS(layers: ShadowLayer[]): string {
  return layers
    .filter(l => l.enabled)
    .map(l => {
      const r = parseInt(l.color.slice(1, 3), 16);
      const g = parseInt(l.color.slice(3, 5), 16);
      const b = parseInt(l.color.slice(5, 7), 16);
      return `${l.inset ? 'inset ' : ''}${l.x}px ${l.y}px ${l.blur}px ${l.spread}px rgba(${r}, ${g}, ${b}, ${l.opacity})`;
    })
    .join(', ') || 'none';
}

function Slider({ label, value, min, max, onChange }: { 
  label: string; value: number; min: number; max: number; onChange: (v: number) => void;
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
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-concrete rounded-full appearance-none cursor-pointer accent-primary"
      />
    </div>
  );
}

export function ButtonSandbox() {
  const [activeTab, setActiveTab] = useState<'buttons' | 'chips' | 'segments' | 'filters'>('buttons');
  const [selectedType, setSelectedType] = useState<ButtonType>('primary');
  const [styles, setStyles] = useState<Record<ButtonType, ButtonStyle>>(defaultButtonStyles);
  const [chipStyles, setChipStyles] = useState<Record<ChipType, ChipStyle>>(defaultChipStyles);
  const [selectedChipType, setSelectedChipType] = useState<ChipType>('filter');
  const [editingShadow, setEditingShadow] = useState<'normal' | 'pressed'>('normal');
  const [shadowLayers, setShadowLayers] = useState<ShadowLayer[]>(() => 
    parseShadow(defaultButtonStyles.primary.shadow)
  );
  const [pressedLayers, setPressedLayers] = useState<ShadowLayer[]>(() => 
    parseShadow(defaultButtonStyles.primary.shadowPressed)
  );
  const [copied, setCopied] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  
  // Segmented Control state
  const [segmentStyle, setSegmentStyle] = useState<SegmentedControlStyle>(defaultSegmentedControlStyle);
  const [activeSegment, setActiveSegment] = useState('tasks');
  
  // Filter Chips state
  const [filterChipStyle, setFilterChipStyle] = useState<FilterChipStyle>(defaultFilterChipStyle);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['all']));

  const currentStyle = styles[selectedType];
  const currentChipStyle = chipStyles[selectedChipType];
  const currentLayers = editingShadow === 'normal' ? shadowLayers : pressedLayers;
  const setCurrentLayers = editingShadow === 'normal' ? setShadowLayers : setPressedLayers;

  const handleSelectType = (type: ButtonType) => {
    setSelectedType(type);
    setShadowLayers(parseShadow(styles[type].shadow));
    setPressedLayers(parseShadow(styles[type].shadowPressed));
  };

  const updateLayer = (index: number, layer: ShadowLayer) => {
    const newLayers = [...currentLayers];
    newLayers[index] = layer;
    setCurrentLayers(newLayers);
    
    const shadowCSS = layersToCSS(newLayers);
    setStyles(prev => ({
      ...prev,
      [selectedType]: {
        ...prev[selectedType],
        [editingShadow === 'normal' ? 'shadow' : 'shadowPressed']: shadowCSS,
      },
    }));
  };

  const updateRadius = (radius: number) => {
    setStyles(prev => ({
      ...prev,
      [selectedType]: { ...prev[selectedType], borderRadius: radius },
    }));
  };

  const updateButtonColor = (key: 'backgroundColor' | 'textColor', value: string) => {
    setStyles(prev => ({
      ...prev,
      [selectedType]: { ...prev[selectedType], [key]: value },
    }));
  };

  const updateChipColor = (key: 'backgroundColor' | 'textColor', value: string) => {
    setChipStyles(prev => ({
      ...prev,
      [selectedChipType]: { ...prev[selectedChipType], [key]: value },
    }));
  };

  const updateChipRadius = (radius: number) => {
    setChipStyles(prev => ({
      ...prev,
      [selectedChipType]: { ...prev[selectedChipType], borderRadius: radius },
    }));
  };

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filter)) {
        newSet.delete(filter);
      } else {
        newSet.add(filter);
      }
      return newSet;
    });
  };

  const reset = () => {
    if (activeTab === 'buttons') {
      setStyles(defaultButtonStyles);
      setShadowLayers(parseShadow(defaultButtonStyles[selectedType].shadow));
      setPressedLayers(parseShadow(defaultButtonStyles[selectedType].shadowPressed));
    } else if (activeTab === 'chips') {
      setChipStyles(defaultChipStyles);
    } else if (activeTab === 'segments') {
      setSegmentStyle(defaultSegmentedControlStyle);
    } else if (activeTab === 'filters') {
      setFilterChipStyle(defaultFilterChipStyle);
    }
  };

  const commitStyles = () => {
    if (activeTab === 'buttons') {
      localStorage.setItem('filla-committed-button-styles', JSON.stringify(styles));
      window.dispatchEvent(new CustomEvent('filla-button-styles-updated', { detail: styles }));
    } else if (activeTab === 'chips') {
      localStorage.setItem('filla-committed-chip-styles', JSON.stringify(chipStyles));
      window.dispatchEvent(new CustomEvent('filla-chip-styles-updated', { detail: chipStyles }));
    } else if (activeTab === 'segments') {
      localStorage.setItem('filla-committed-segment-styles', JSON.stringify(segmentStyle));
      window.dispatchEvent(new CustomEvent('filla-segment-styles-updated', { detail: segmentStyle }));
    } else if (activeTab === 'filters') {
      localStorage.setItem('filla-committed-filter-chip-styles', JSON.stringify(filterChipStyle));
      window.dispatchEvent(new CustomEvent('filla-filter-chip-styles-updated', { detail: filterChipStyle }));
    }
    setCommitted(true);
    setTimeout(() => setCommitted(false), 2000);
  };

  const fullButtonCSS = useMemo(() => {
    const s = styles[selectedType];
    return `/* ${selectedType} button */
box-shadow: ${s.shadow};
border-radius: ${s.borderRadius}px;
background-color: ${s.backgroundColor};
color: ${s.textColor};

/* Pressed state */
box-shadow: ${s.shadowPressed};`;
  }, [styles, selectedType]);

  const fullChipCSS = useMemo(() => {
    const s = chipStyles[selectedChipType];
    return `/* ${selectedChipType} chip */
background-color: ${s.backgroundColor};
color: ${s.textColor};
border-radius: ${s.borderRadius}px;`;
  }, [chipStyles, selectedChipType]);

  const fullSegmentCSS = useMemo(() => {
    return `/* Segmented Control Track */
background-color: ${segmentStyle.trackBackgroundColor};
border-radius: ${segmentStyle.trackBorderRadius}px;
box-shadow: ${segmentStyle.trackShadow};

/* Inactive Button */
background-color: ${segmentStyle.buttonBackgroundColor};
color: ${segmentStyle.buttonTextColor};
border-radius: ${segmentStyle.buttonBorderRadius}px;

/* Active Button */
background-color: ${segmentStyle.activeButtonBackgroundColor};
color: ${segmentStyle.activeButtonTextColor};
box-shadow: ${segmentStyle.buttonShadow !== 'none' ? segmentStyle.buttonShadow : '2px 2px 6px rgba(0,0,0,0.1)'};`;
  }, [segmentStyle]);

  const fullFilterChipCSS = useMemo(() => {
    return `/* Active Filter Chip */
background-color: ${filterChipStyle.activeBackgroundColor};
color: ${filterChipStyle.activeTextColor};
border-radius: ${filterChipStyle.borderRadius}px;
box-shadow: ${filterChipStyle.shadow};

/* Inactive Filter Chip */
background-color: ${filterChipStyle.inactiveBackgroundColor};
color: ${filterChipStyle.inactiveTextColor};`;
  }, [filterChipStyle]);

  const getActiveCSS = () => {
    switch (activeTab) {
      case 'buttons': return fullButtonCSS;
      case 'chips': return fullChipCSS;
      case 'segments': return fullSegmentCSS;
      case 'filters': return fullFilterChipCSS;
    }
  };

  const copyCSS = () => {
    navigator.clipboard.writeText(getActiveCSS());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-semibold text-ink tracking-tight">Button & Component Sandbox</h2>
        <p className="text-muted-foreground text-sm">Edit neumorphic button, chip, segment, and filter styles with live preview</p>
      </div>

      {/* Tab Switch */}
      <div className="flex flex-wrap gap-2">
        {(['buttons', 'chips', 'segments', 'filters'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-wider transition-all',
              activeTab === tab ? 'bg-primary text-white' : 'bg-surface/80 shadow-e1 text-ink/60'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Preview */}
        <div className="space-y-4">
          <div className="bg-transparent rounded-xl p-4 sm:p-8 border border-dashed border-concrete/50">
            {activeTab === 'buttons' && (
              <>
                {/* Button Type Selector */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {(['primary', 'secondary', 'ghost', 'danger'] as ButtonType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => handleSelectType(type)}
                      className={cn(
                        'px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wider transition-all',
                        selectedType === type 
                          ? 'bg-primary text-white' 
                          : 'bg-surface/80 shadow-e1 text-ink/60 hover:text-ink'
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                {/* Live Button Preview */}
                <div className="flex flex-wrap gap-4 justify-center">
                  {(['sm', 'md', 'lg'] as const).map((size) => (
                    <button
                      key={size}
                      onMouseDown={() => setIsPressed(true)}
                      onMouseUp={() => setIsPressed(false)}
                      onMouseLeave={() => setIsPressed(false)}
                      className={cn(
                        'font-semibold transition-all duration-150 active:scale-[0.98]',
                        size === 'sm' && 'px-3 py-1.5 text-xs',
                        size === 'md' && 'px-5 py-3 text-sm',
                        size === 'lg' && 'px-8 py-4 text-base',
                      )}
                      style={{
                        boxShadow: isPressed ? currentStyle.shadowPressed : currentStyle.shadow,
                        borderRadius: currentStyle.borderRadius,
                        backgroundColor: currentStyle.backgroundColor,
                        color: currentStyle.textColor,
                      }}
                    >
                      {size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large'}
                    </button>
                  ))}
                </div>

                {/* With Icon */}
                <div className="flex justify-center mt-4">
                  <button
                    onMouseDown={() => setIsPressed(true)}
                    onMouseUp={() => setIsPressed(false)}
                    onMouseLeave={() => setIsPressed(false)}
                    className="flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all duration-150 active:scale-[0.98]"
                    style={{
                      boxShadow: isPressed ? currentStyle.shadowPressed : currentStyle.shadow,
                      borderRadius: currentStyle.borderRadius,
                      backgroundColor: currentStyle.backgroundColor,
                      color: currentStyle.textColor,
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    With Icon
                  </button>
                </div>
              </>
            )}
            
            {activeTab === 'chips' && (
              <>
                {/* Chip Type Selector */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {(['filter', 'status', 'priority'] as ChipType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setSelectedChipType(type)}
                      className={cn(
                        'px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wider transition-all',
                        selectedChipType === type 
                          ? 'bg-primary text-white' 
                          : 'bg-surface/80 shadow-e1 text-ink/60 hover:text-ink'
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                {/* Live Chip Preview */}
                <div className="flex flex-wrap gap-3 justify-center">
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider font-medium"
                    style={{
                      backgroundColor: currentChipStyle.backgroundColor,
                      color: currentChipStyle.textColor,
                      borderRadius: currentChipStyle.borderRadius,
                    }}
                  >
                    <Check className="w-3 h-3" />
                    Selected
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider font-medium"
                    style={{
                      backgroundColor: currentChipStyle.backgroundColor,
                      color: currentChipStyle.textColor,
                      borderRadius: currentChipStyle.borderRadius,
                    }}
                  >
                    Normal
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider font-medium cursor-pointer hover:opacity-80"
                    style={{
                      backgroundColor: currentChipStyle.backgroundColor,
                      color: currentChipStyle.textColor,
                      borderRadius: currentChipStyle.borderRadius,
                    }}
                  >
                    Removable
                    <X className="w-3 h-3" />
                  </span>
                </div>
              </>
            )}

            {activeTab === 'segments' && (
              <>
                <p className="text-center text-muted-foreground text-xs mb-6 font-mono uppercase tracking-wider">
                  Segmented Control Preview
                </p>
                
                {/* Live Segmented Control Preview */}
                <div className="flex justify-center">
                  <div
                    className="p-1.5 flex items-center relative"
                    style={{
                      backgroundColor: segmentStyle.trackBackgroundColor,
                      borderRadius: segmentStyle.trackBorderRadius,
                      boxShadow: segmentStyle.trackShadow,
                    }}
                  >
                    {['tasks', 'inbox', 'schedule'].map(seg => {
                      const isActive = activeSegment === seg;
                      return (
                        <button
                          key={seg}
                          onClick={() => setActiveSegment(seg)}
                          className={cn(
                            'relative z-10 px-4 py-2 text-xs font-bold transition-all duration-200',
                            'text-center capitalize'
                          )}
                          style={{
                            backgroundColor: isActive ? segmentStyle.activeButtonBackgroundColor : segmentStyle.buttonBackgroundColor,
                            color: isActive ? segmentStyle.activeButtonTextColor : segmentStyle.buttonTextColor,
                            borderRadius: segmentStyle.buttonBorderRadius,
                            boxShadow: isActive ? '2px 2px 6px rgba(0,0,0,0.1), -1px -1px 4px rgba(255,255,255,0.8)' : segmentStyle.buttonShadow,
                            transform: isActive ? 'scale(1.02)' : 'scale(1)',
                          }}
                        >
                          {seg}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Larger variant preview */}
                <div className="flex justify-center mt-6">
                  <div
                    className="p-2 flex items-center relative w-full max-w-md"
                    style={{
                      backgroundColor: segmentStyle.trackBackgroundColor,
                      borderRadius: segmentStyle.trackBorderRadius,
                      boxShadow: segmentStyle.trackShadow,
                    }}
                  >
                    {['All', 'Active', 'Completed', 'Overdue'].map(seg => {
                      const isActive = seg === 'All';
                      return (
                        <button
                          key={seg}
                          className={cn(
                            'relative z-10 flex-1 px-3 py-2.5 text-[11px] font-bold transition-all duration-200',
                            'text-center uppercase tracking-wider'
                          )}
                          style={{
                            backgroundColor: isActive ? segmentStyle.activeButtonBackgroundColor : segmentStyle.buttonBackgroundColor,
                            color: isActive ? segmentStyle.activeButtonTextColor : segmentStyle.buttonTextColor,
                            borderRadius: segmentStyle.buttonBorderRadius,
                            boxShadow: isActive ? '2px 2px 6px rgba(0,0,0,0.1), -1px -1px 4px rgba(255,255,255,0.8)' : segmentStyle.buttonShadow,
                          }}
                        >
                          {seg}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'filters' && (
              <>
                <p className="text-center text-muted-foreground text-xs mb-6 font-mono uppercase tracking-wider">
                  Filter Chips Preview (Click to Toggle)
                </p>
                
                {/* Live Filter Chips Preview */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {['all', 'urgent', 'today', 'compliance', 'assigned'].map(filter => {
                    const isActive = activeFilters.has(filter);
                    return (
                      <button
                        key={filter}
                        onClick={() => toggleFilter(filter)}
                        className={cn(
                          'px-4 py-2 font-mono text-[11px] uppercase tracking-wider font-medium transition-all duration-150',
                          'hover:opacity-90 active:scale-[0.97]'
                        )}
                        style={{
                          backgroundColor: isActive ? filterChipStyle.activeBackgroundColor : filterChipStyle.inactiveBackgroundColor,
                          color: isActive ? filterChipStyle.activeTextColor : filterChipStyle.inactiveTextColor,
                          borderRadius: filterChipStyle.borderRadius,
                          boxShadow: isActive ? filterChipStyle.shadow : 'none',
                        }}
                      >
                        {isActive && <Check className="w-3 h-3 inline-block mr-1.5" />}
                        {filter}
                      </button>
                    );
                  })}
                </div>

                {/* Compact variant */}
                <div className="flex flex-wrap gap-1.5 justify-center mt-6">
                  {['property', 'space', 'team', 'vendor'].map(filter => {
                    const isActive = filter === 'property';
                    return (
                      <span
                        key={filter}
                        className="px-3 py-1 font-mono text-[10px] uppercase tracking-wider font-medium cursor-pointer"
                        style={{
                          backgroundColor: isActive ? filterChipStyle.activeBackgroundColor : filterChipStyle.inactiveBackgroundColor,
                          color: isActive ? filterChipStyle.activeTextColor : filterChipStyle.inactiveTextColor,
                          borderRadius: filterChipStyle.borderRadius,
                          boxShadow: isActive ? filterChipStyle.shadow : 'none',
                        }}
                      >
                        {filter}
                      </span>
                    );
                  })}
                </div>
              </>
            )}
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
            <pre className="text-xs text-primary font-mono overflow-x-auto whitespace-pre-wrap">
              {getActiveCSS()}
            </pre>
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
              `Commit & Apply ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Styles`
            )}
          </button>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {activeTab === 'buttons' && (
            <>
              {/* State Toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingShadow('normal')}
                  className={cn(
                    'px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-wider transition-all',
                    editingShadow === 'normal' ? 'bg-primary text-white' : 'bg-surface/80 shadow-e1 text-ink/60'
                  )}
                >
                  Normal State
                </button>
                <button
                  onClick={() => setEditingShadow('pressed')}
                  className={cn(
                    'px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-wider transition-all',
                    editingShadow === 'pressed' ? 'bg-primary text-white' : 'bg-surface/80 shadow-e1 text-ink/60'
                  )}
                >
                  Pressed State
                </button>
              </div>

              {/* Global Controls */}
              <div className="bg-surface/50 rounded-lg shadow-e1 p-3 sm:p-4 space-y-4">
                <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Button Style</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Slider 
                    label="Border Radius" 
                    value={currentStyle.borderRadius} 
                    min={0} 
                    max={30} 
                    onChange={updateRadius} 
                  />
                  <div className="space-y-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Background</span>
                    <input
                      type="color"
                      value={currentStyle.backgroundColor === 'transparent' ? '#F1EEE8' : currentStyle.backgroundColor}
                      onChange={(e) => updateButtonColor('backgroundColor', e.target.value)}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Text Color</span>
                    <input
                      type="color"
                      value={currentStyle.textColor}
                      onChange={(e) => updateButtonColor('textColor', e.target.value)}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Shadow Layers */}
              <div className="space-y-3 max-h-[300px] lg:max-h-[400px] overflow-y-auto pr-2">
                <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Shadow Layers ({editingShadow})
                </h3>
                {currentLayers.map((layer, i) => (
                  <div key={i} className={cn(
                    'p-3 rounded-lg border',
                    layer.enabled ? 'bg-surface/50 border-primary/20' : 'bg-concrete/30 border-transparent'
                  )}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-ink font-medium">
                        {layer.inset ? 'Inner' : 'Outer'} {i + 1}
                      </span>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={layer.enabled}
                          onChange={(e) => updateLayer(i, { ...layer, enabled: e.target.checked })}
                          className="w-4 h-4 rounded border-concrete accent-primary"
                        />
                      </label>
                    </div>
                    {layer.enabled && (
                      <div className="grid grid-cols-2 gap-3">
                        <Slider label="X" value={layer.x} min={-30} max={30} onChange={(v) => updateLayer(i, { ...layer, x: v })} />
                        <Slider label="Y" value={layer.y} min={-30} max={30} onChange={(v) => updateLayer(i, { ...layer, y: v })} />
                        <Slider label="Blur" value={layer.blur} min={0} max={40} onChange={(v) => updateLayer(i, { ...layer, blur: v })} />
                        <Slider label="Spread" value={layer.spread} min={-10} max={20} onChange={(v) => updateLayer(i, { ...layer, spread: v })} />
                        <Slider label="Opacity" value={Math.round(layer.opacity * 100)} min={0} max={100} onChange={(v) => updateLayer(i, { ...layer, opacity: v / 100 })} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          
          {activeTab === 'chips' && (
            <>
              {/* Chip Controls */}
              <div className="bg-surface/50 rounded-lg shadow-e1 p-3 sm:p-4 space-y-4">
                <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Chip Style</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Slider 
                    label="Border Radius" 
                    value={currentChipStyle.borderRadius} 
                    min={0} 
                    max={50} 
                    onChange={updateChipRadius} 
                  />
                  <div className="space-y-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Background</span>
                    <input
                      type="color"
                      value={currentChipStyle.backgroundColor.slice(0, 7)}
                      onChange={(e) => updateChipColor('backgroundColor', e.target.value)}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Text Color</span>
                    <input
                      type="color"
                      value={currentChipStyle.textColor}
                      onChange={(e) => updateChipColor('textColor', e.target.value)}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'segments' && (
            <>
              {/* Track Controls */}
              <div className="bg-surface/50 rounded-lg shadow-e1 p-3 sm:p-4 space-y-4">
                <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Track Style</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Slider 
                    label="Track Radius" 
                    value={segmentStyle.trackBorderRadius} 
                    min={0} 
                    max={24} 
                    onChange={(v) => setSegmentStyle(prev => ({ ...prev, trackBorderRadius: v }))} 
                  />
                  <div className="space-y-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Track Background</span>
                    <input
                      type="color"
                      value={segmentStyle.trackBackgroundColor}
                      onChange={(e) => setSegmentStyle(prev => ({ ...prev, trackBackgroundColor: e.target.value }))}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Button Controls */}
              <div className="bg-surface/50 rounded-lg shadow-e1 p-3 sm:p-4 space-y-4">
                <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Button Style</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Slider 
                    label="Button Radius" 
                    value={segmentStyle.buttonBorderRadius} 
                    min={0} 
                    max={20} 
                    onChange={(v) => setSegmentStyle(prev => ({ ...prev, buttonBorderRadius: v }))} 
                  />
                  <div className="space-y-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Inactive Text</span>
                    <input
                      type="color"
                      value={segmentStyle.buttonTextColor}
                      onChange={(e) => setSegmentStyle(prev => ({ ...prev, buttonTextColor: e.target.value }))}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Active Button Controls */}
              <div className="bg-surface/50 rounded-lg shadow-e1 p-3 sm:p-4 space-y-4">
                <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Active Button Style</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Active Background</span>
                    <input
                      type="color"
                      value={segmentStyle.activeButtonBackgroundColor}
                      onChange={(e) => setSegmentStyle(prev => ({ ...prev, activeButtonBackgroundColor: e.target.value }))}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Active Text</span>
                    <input
                      type="color"
                      value={segmentStyle.activeButtonTextColor}
                      onChange={(e) => setSegmentStyle(prev => ({ ...prev, activeButtonTextColor: e.target.value }))}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'filters' && (
            <>
              {/* Active State Controls */}
              <div className="bg-surface/50 rounded-lg shadow-e1 p-3 sm:p-4 space-y-4">
                <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Active Chip Style</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Slider 
                    label="Border Radius" 
                    value={filterChipStyle.borderRadius} 
                    min={0} 
                    max={50} 
                    onChange={(v) => setFilterChipStyle(prev => ({ ...prev, borderRadius: v }))} 
                  />
                  <div className="space-y-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Active Background</span>
                    <input
                      type="color"
                      value={filterChipStyle.activeBackgroundColor}
                      onChange={(e) => setFilterChipStyle(prev => ({ ...prev, activeBackgroundColor: e.target.value }))}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Active Text</span>
                    <input
                      type="color"
                      value={filterChipStyle.activeTextColor}
                      onChange={(e) => setFilterChipStyle(prev => ({ ...prev, activeTextColor: e.target.value }))}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Inactive State Controls */}
              <div className="bg-surface/50 rounded-lg shadow-e1 p-3 sm:p-4 space-y-4">
                <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Inactive Chip Style</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Inactive Background</span>
                    <input
                      type="color"
                      value={filterChipStyle.inactiveBackgroundColor}
                      onChange={(e) => setFilterChipStyle(prev => ({ ...prev, inactiveBackgroundColor: e.target.value }))}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Inactive Text</span>
                    <input
                      type="color"
                      value={filterChipStyle.inactiveTextColor}
                      onChange={(e) => setFilterChipStyle(prev => ({ ...prev, inactiveTextColor: e.target.value }))}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
