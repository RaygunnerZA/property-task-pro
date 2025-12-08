import React, { useState, useMemo } from 'react';
import { Copy, Check, RotateCcw, Plus, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type ButtonType = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonStyle {
  shadow: string;
  shadowPressed: string;
  borderRadius: number;
  backgroundColor: string;
}

const defaultStyles: Record<ButtonType, ButtonStyle> = {
  primary: {
    shadow: '3px 5px 7px 2px rgba(0, 0, 0, 0.06), -4px -5px 11px 4px rgba(255, 255, 255, 0.52), inset 2px 2px 0px 0px rgba(255, 255, 255, 0), inset -2px -3px 4px 0px rgba(0, 0, 0, 0.06)',
    shadowPressed: '0px 0px 7px 2px rgba(0, 0, 0, 0.01), inset -3px -9px 17px 0px rgba(255, 255, 255, 0.49), inset 1px 13px 19px 0px rgba(0, 0, 0, 0.09)',
    borderRadius: 10,
    backgroundColor: '#8EC9CE',
  },
  secondary: {
    shadow: '2px 6px 5px -3px rgba(0, 0, 0, 0.07), -2px -2px 8px -3px rgba(255, 255, 255, 0.19), inset 0px -2px 2px 0px rgba(0, 0, 0, 0.1), inset 1px 2px 2px 0px rgba(255, 255, 255, 1)',
    shadowPressed: '3px 4px 3px -3px rgba(255, 255, 255, 1), -2px -2px 5px -3px rgba(0, 0, 0, 0.05), inset -3px -3px 2px 0px rgba(0, 0, 0, 0.01), inset 1px 2px 2px 0px rgba(0, 0, 0, 0.08)',
    borderRadius: 10,
    backgroundColor: '#F1EEE8',
  },
  ghost: {
    shadow: 'none',
    shadowPressed: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  danger: {
    shadow: '2px 4px 8px -2px rgba(239, 68, 68, 0.3), -2px -2px 6px -2px rgba(255, 255, 255, 0.4)',
    shadowPressed: 'inset 0 2px 6px rgba(239, 68, 68, 0.2)',
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
  },
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
  const [selectedType, setSelectedType] = useState<ButtonType>('primary');
  const [styles, setStyles] = useState<Record<ButtonType, ButtonStyle>>(defaultStyles);
  const [editingShadow, setEditingShadow] = useState<'normal' | 'pressed'>('normal');
  const [shadowLayers, setShadowLayers] = useState<ShadowLayer[]>(() => 
    parseShadow(defaultStyles.primary.shadow)
  );
  const [pressedLayers, setPressedLayers] = useState<ShadowLayer[]>(() => 
    parseShadow(defaultStyles.primary.shadowPressed)
  );
  const [copied, setCopied] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const currentStyle = styles[selectedType];
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
    
    // Update the styles
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

  const reset = () => {
    setStyles(defaultStyles);
    setShadowLayers(parseShadow(defaultStyles[selectedType].shadow));
    setPressedLayers(parseShadow(defaultStyles[selectedType].shadowPressed));
  };

  const fullCSS = useMemo(() => {
    const s = styles[selectedType];
    return `/* ${selectedType} button */
box-shadow: ${s.shadow};
border-radius: ${s.borderRadius}px;
background-color: ${s.backgroundColor};

/* Pressed state */
box-shadow: ${s.shadowPressed};`;
  }, [styles, selectedType]);

  const copyCSS = () => {
    navigator.clipboard.writeText(fullCSS);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-semibold text-ink tracking-tight">Button Sandbox</h2>
        <p className="text-muted-foreground text-sm">Edit neumorphic button styles with live preview</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preview */}
        <div className="space-y-4">
          <div className="bg-background rounded-xl p-8 flex flex-col items-center gap-6">
            {/* Button Type Selector */}
            <div className="flex gap-2">
              {(['primary', 'secondary', 'ghost', 'danger'] as ButtonType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => handleSelectType(type)}
                  className={cn(
                    'px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-wider transition-all',
                    selectedType === type 
                      ? 'bg-primary text-white' 
                      : 'bg-surface shadow-e1 text-ink/60 hover:text-ink'
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
                    selectedType === 'primary' && 'text-white',
                    selectedType === 'secondary' && 'text-ink',
                    selectedType === 'ghost' && 'text-ink/60',
                    selectedType === 'danger' && 'text-destructive',
                  )}
                  style={{
                    boxShadow: isPressed ? currentStyle.shadowPressed : currentStyle.shadow,
                    borderRadius: currentStyle.borderRadius,
                    backgroundColor: currentStyle.backgroundColor,
                  }}
                >
                  {size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large'}
                </button>
              ))}
            </div>

            {/* With Icon */}
            <button
              onMouseDown={() => setIsPressed(true)}
              onMouseUp={() => setIsPressed(false)}
              onMouseLeave={() => setIsPressed(false)}
              className={cn(
                'flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all duration-150 active:scale-[0.98]',
                selectedType === 'primary' && 'text-white',
                selectedType === 'secondary' && 'text-ink',
                selectedType === 'ghost' && 'text-ink/60',
                selectedType === 'danger' && 'text-destructive',
              )}
              style={{
                boxShadow: isPressed ? currentStyle.shadowPressed : currentStyle.shadow,
                borderRadius: currentStyle.borderRadius,
                backgroundColor: currentStyle.backgroundColor,
              }}
            >
              <Plus className="w-4 h-4" />
              With Icon
            </button>
          </div>

          {/* CSS Output */}
          <div className="bg-ink rounded-lg p-4 space-y-3">
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
            <pre className="text-xs text-primary font-mono overflow-x-auto whitespace-pre-wrap">{fullCSS}</pre>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {/* State Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setEditingShadow('normal')}
              className={cn(
                'px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-wider transition-all',
                editingShadow === 'normal' ? 'bg-primary text-white' : 'bg-surface shadow-e1 text-ink/60'
              )}
            >
              Normal State
            </button>
            <button
              onClick={() => setEditingShadow('pressed')}
              className={cn(
                'px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-wider transition-all',
                editingShadow === 'pressed' ? 'bg-primary text-white' : 'bg-surface shadow-e1 text-ink/60'
              )}
            >
              Pressed State
            </button>
          </div>

          {/* Global Controls */}
          <div className="bg-surface rounded-lg shadow-e1 p-4 space-y-4">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Global</h3>
            <Slider 
              label="Border Radius" 
              value={currentStyle.borderRadius} 
              min={0} 
              max={30} 
              onChange={updateRadius} 
            />
          </div>

          {/* Shadow Layers */}
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Shadow Layers ({editingShadow})
            </h3>
            {currentLayers.map((layer, i) => (
              <div key={i} className={cn(
                'p-3 rounded-lg border',
                layer.enabled ? 'bg-surface border-primary/20' : 'bg-concrete/30 border-transparent'
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
        </div>
      </div>
    </section>
  );
}
