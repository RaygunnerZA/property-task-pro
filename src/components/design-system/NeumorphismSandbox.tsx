import React, { useState, useMemo, useEffect } from 'react';
import { Copy, Check, RotateCcw, ChevronDown, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { defaultNeumorphicStyles, type NeumorphicStyle } from './NeumorphicStylesDisplay';

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

// Parse a box-shadow string into ShadowLayer array
function parseBoxShadow(boxShadow: string): ShadowLayer[] {
  const layers: ShadowLayer[] = [];
  const shadowParts = boxShadow.split(/,(?![^(]*\))/);
  
  shadowParts.forEach((part) => {
    const trimmed = part.trim();
    const isInset = trimmed.startsWith('inset');
    const values = trimmed.replace('inset', '').trim();
    
    // Match: x y blur spread color
    const match = values.match(/(-?\d+)px\s+(-?\d+)px\s+(\d+)px\s+(-?\d+)?\s*px?\s*(rgba?\([^)]+\)|#[a-fA-F0-9]+)?/);
    
    if (match) {
      const [, x, y, blur, spread, colorStr] = match;
      let color = '#000000';
      let opacity = 1;
      
      if (colorStr) {
        if (colorStr.startsWith('rgba')) {
          const rgbaMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/);
          if (rgbaMatch) {
            const [, r, g, b, a] = rgbaMatch;
            color = `#${parseInt(r).toString(16).padStart(2, '0')}${parseInt(g).toString(16).padStart(2, '0')}${parseInt(b).toString(16).padStart(2, '0')}`;
            opacity = a ? parseFloat(a) : 1;
          }
        } else {
          color = colorStr;
        }
      }
      
      layers.push({
        enabled: true,
        x: parseInt(x),
        y: parseInt(y),
        blur: parseInt(blur),
        spread: parseInt(spread) || 0,
        color,
        opacity,
        inset: isInset,
      });
    }
  });
  
  // Ensure we have at least 4 layers
  while (layers.length < 4) {
    layers.push({
      enabled: false,
      x: 0,
      y: 0,
      blur: 0,
      spread: 0,
      color: '#000000',
      opacity: 0.1,
      inset: layers.length >= 2,
    });
  }
  
  return layers;
}

const defaultLayers: ShadowLayer[] = [
  { enabled: true, x: 4, y: 4, blur: 12, spread: 0, color: '#000000', opacity: 0.06, inset: false },
  { enabled: true, x: -4, y: -4, blur: 8, spread: 0, color: '#ffffff', opacity: 0.8, inset: false },
  { enabled: true, x: 2, y: 2, blur: 4, spread: 0, color: '#000000', opacity: 0.04, inset: true },
  { enabled: false, x: -1, y: -1, blur: 2, spread: 0, color: '#ffffff', opacity: 0.6, inset: true },
];

const defaultGlobals = {
  borderRadius: 16,
  noiseIntensity: 0,
  backgroundColor: '#F1EEE8',
  topLight: true,
};

function Slider({ 
  label, 
  value, 
  min, 
  max, 
  onChange 
}: { 
  label: string; 
  value: number; 
  min: number; 
  max: number; 
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
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-concrete rounded-full appearance-none cursor-pointer accent-primary"
      />
    </div>
  );
}

function ShadowLayerControls({
  layer,
  index,
  onChange,
}: {
  layer: ShadowLayer;
  index: number;
  onChange: (layer: ShadowLayer) => void;
}) {
  const layerName = layer.inset 
    ? `Inner Shadow ${index - 1}` 
    : `Outer Shadow ${index + 1}`;

  return (
    <div className={cn(
      'p-3 rounded-lg border',
      layer.enabled ? 'bg-surface border-primary/20' : 'bg-concrete/30 border-transparent'
    )}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink font-medium">
          {layerName}
        </span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={layer.enabled}
            onChange={(e) => onChange({ ...layer, enabled: e.target.checked })}
            className="w-4 h-4 rounded border-concrete accent-primary"
          />
          <span className="font-mono text-[9px] uppercase text-muted-foreground">On</span>
        </label>
      </div>

      {layer.enabled && (
        <div className="grid grid-cols-2 gap-3">
          <Slider label="X Offset" value={layer.x} min={-30} max={30} onChange={(v) => onChange({ ...layer, x: v })} />
          <Slider label="Y Offset" value={layer.y} min={-30} max={30} onChange={(v) => onChange({ ...layer, y: v })} />
          <Slider label="Blur" value={layer.blur} min={0} max={40} onChange={(v) => onChange({ ...layer, blur: v })} />
          {!layer.inset && (
            <Slider label="Spread" value={layer.spread} min={-10} max={20} onChange={(v) => onChange({ ...layer, spread: v })} />
          )}
          <div className="space-y-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Color</span>
            <input
              type="color"
              value={layer.color}
              onChange={(e) => onChange({ ...layer, color: e.target.value })}
              className="w-full h-8 rounded cursor-pointer"
            />
          </div>
          <Slider label="Opacity" value={Math.round(layer.opacity * 100)} min={0} max={100} onChange={(v) => onChange({ ...layer, opacity: v / 100 })} />
        </div>
      )}
    </div>
  );
}

export function NeumorphismSandbox() {
  const [layers, setLayers] = useState<ShadowLayer[]>(defaultLayers);
  const [globals, setGlobals] = useState(defaultGlobals);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [customStyles, setCustomStyles] = useState<NeumorphicStyle[]>(() => {
    const stored = localStorage.getItem('filla-custom-neu-styles');
    return stored ? JSON.parse(stored) : [];
  });

  const allStyles = [...defaultNeumorphicStyles, ...customStyles];

  const updateLayer = (index: number, layer: ShadowLayer) => {
    const newLayers = [...layers];
    newLayers[index] = layer;
    setLayers(newLayers);
  };

  const reset = () => {
    setLayers(defaultLayers);
    setGlobals(defaultGlobals);
    setSelectedPreset('');
  };

  const loadPreset = (style: NeumorphicStyle) => {
    setSelectedPreset(style.key);
    setGlobals({
      ...globals,
      borderRadius: style.borderRadius,
      backgroundColor: style.backgroundColor,
    });
    setLayers(parseBoxShadow(style.boxShadow));
    setIsDropdownOpen(false);
  };

  const shadowCSS = useMemo(() => {
    return layers
      .filter((l) => l.enabled)
      .map((l) => {
        const rgba = `rgba(${parseInt(l.color.slice(1, 3), 16)}, ${parseInt(l.color.slice(3, 5), 16)}, ${parseInt(l.color.slice(5, 7), 16)}, ${l.opacity})`;
        return `${l.inset ? 'inset ' : ''}${l.x}px ${l.y}px ${l.blur}px ${l.spread}px ${rgba}`;
      })
      .join(', ');
  }, [layers]);

  const fullCSS = `box-shadow: ${shadowCSS};\nborder-radius: ${globals.borderRadius}px;\nbackground-color: ${globals.backgroundColor};`;

  const copyCSS = () => {
    navigator.clipboard.writeText(fullCSS);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const saveAsPreset = () => {
    const name = prompt('Enter a name for this preset:');
    if (!name) return;
    
    const key = name.toLowerCase().replace(/\s+/g, '_');
    const newStyle: NeumorphicStyle = {
      name,
      key,
      boxShadow: shadowCSS,
      borderRadius: globals.borderRadius,
      backgroundColor: globals.backgroundColor,
    };
    
    const updatedStyles = [...customStyles, newStyle];
    setCustomStyles(updatedStyles);
    localStorage.setItem('filla-custom-neu-styles', JSON.stringify(updatedStyles));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-semibold text-ink tracking-tight">Neumorphism Sandbox</h2>
        <p className="text-muted-foreground text-sm">Adjust shadow layers to create custom neumorphic effects</p>
      </div>

      {/* Preset Dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center justify-between w-full max-w-xs px-4 py-3 bg-surface rounded-lg shadow-e1 text-left"
        >
          <span className="font-mono text-sm text-ink">
            {selectedPreset ? allStyles.find(s => s.key === selectedPreset)?.name : 'Select a preset...'}
          </span>
          <ChevronDown className={cn(
            'w-4 h-4 text-muted-foreground transition-transform',
            isDropdownOpen && 'rotate-180'
          )} />
        </button>
        
        {isDropdownOpen && (
          <div className="absolute z-50 top-full left-0 mt-1 w-full max-w-xs bg-surface rounded-lg shadow-e2 border border-concrete overflow-hidden">
            {allStyles.map((style) => (
              <button
                key={style.key}
                onClick={() => loadPreset(style)}
                className={cn(
                  'w-full px-4 py-2.5 text-left font-mono text-sm hover:bg-concrete/50 transition-colors',
                  selectedPreset === style.key && 'bg-primary/10 text-primary'
                )}
              >
                {style.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preview */}
        <div className="space-y-4">
          <div 
            className="h-64 flex items-center justify-center rounded-xl"
            style={{ backgroundColor: globals.backgroundColor }}
          >
            <div
              className="w-32 h-32 flex items-center justify-center"
              style={{
                boxShadow: shadowCSS,
                borderRadius: globals.borderRadius,
                backgroundColor: globals.backgroundColor,
              }}
            >
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Preview</span>
            </div>
          </div>

          {/* CSS Output */}
          <div className="bg-ink rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-wider text-white/60">CSS Output</span>
              <div className="flex gap-2">
                <button
                  onClick={saveAsPreset}
                  className="p-1.5 rounded hover:bg-white/10 transition-colors"
                  title="Save as preset"
                >
                  {saved ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Save className="w-4 h-4 text-white/60" />
                  )}
                </button>
                <button
                  onClick={reset}
                  className="p-1.5 rounded hover:bg-white/10 transition-colors"
                  title="Reset to defaults"
                >
                  <RotateCcw className="w-4 h-4 text-white/60" />
                </button>
                <button
                  onClick={copyCSS}
                  className="p-1.5 rounded hover:bg-white/10 transition-colors"
                  title="Copy CSS"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-white/60" />
                  )}
                </button>
              </div>
            </div>
            <pre className="text-xs text-primary font-mono overflow-x-auto whitespace-pre-wrap">
              {fullCSS}
            </pre>
          </div>

          {/* Global Controls */}
          <div className="bg-surface rounded-lg shadow-e1 p-4 space-y-4">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Global Controls</h3>
            <div className="grid grid-cols-2 gap-4">
              <Slider 
                label="Border Radius" 
                value={globals.borderRadius} 
                min={0} 
                max={50} 
                onChange={(v) => setGlobals({ ...globals, borderRadius: v })} 
              />
              <Slider 
                label="Noise" 
                value={globals.noiseIntensity} 
                min={0} 
                max={40} 
                onChange={(v) => setGlobals({ ...globals, noiseIntensity: v })} 
              />
              <div className="space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Background</span>
                <input
                  type="color"
                  value={globals.backgroundColor}
                  onChange={(e) => setGlobals({ ...globals, backgroundColor: e.target.value })}
                  className="w-full h-8 rounded cursor-pointer"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer self-end pb-1">
                <input
                  type="checkbox"
                  checked={globals.topLight}
                  onChange={(e) => setGlobals({ ...globals, topLight: e.target.checked })}
                  className="w-4 h-4 rounded border-concrete accent-primary"
                />
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Top Light</span>
              </label>
            </div>
          </div>
        </div>

        {/* Shadow Layer Controls */}
        <div className="space-y-4">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Shadow Layers</h3>
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
            {layers.map((layer, i) => (
              <ShadowLayerControls
                key={i}
                layer={layer}
                index={i}
                onChange={(l) => updateLayer(i, l)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
