import React, { useState, useMemo } from 'react';
import { Copy, Check, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TypographyConfig {
  textShadow: string;
  letterSpacing: number;
  fontWeight: number;
}

interface ShadowLayer {
  x: number;
  y: number;
  blur: number;
  color: string;
  opacity: number;
}

const defaultXL: TypographyConfig = {
  textShadow: '2px 2px 3px rgba(255, 255, 255, 0.9), -1px -1px 2px rgba(0, 0, 0, 0.15)',
  letterSpacing: -1,
  fontWeight: 700,
};

const defaultL: TypographyConfig = {
  textShadow: '1px 1px 2px rgba(255, 255, 255, 0.8), -1px -1px 1px rgba(0, 0, 0, 0.1)',
  letterSpacing: -0.5,
  fontWeight: 600,
};

function parseShadow(shadowString: string): ShadowLayer[] {
  const layers: ShadowLayer[] = [];
  const regex = /(-?\d+)px\s+(-?\d+)px\s+(\d+)px\s+rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/g;
  let match;
  
  while ((match = regex.exec(shadowString)) !== null) {
    layers.push({
      x: parseInt(match[1]),
      y: parseInt(match[2]),
      blur: parseInt(match[3]),
      color: `#${parseInt(match[4]).toString(16).padStart(2, '0')}${parseInt(match[5]).toString(16).padStart(2, '0')}${parseInt(match[6]).toString(16).padStart(2, '0')}`,
      opacity: parseFloat(match[7]),
    });
  }
  
  return layers.length >= 2 ? layers : [
    { x: 2, y: 2, blur: 3, color: '#ffffff', opacity: 0.9 },
    { x: -1, y: -1, blur: 2, color: '#000000', opacity: 0.15 },
  ];
}

function layersToCSS(layers: ShadowLayer[]): string {
  return layers.map(l => {
    const r = parseInt(l.color.slice(1, 3), 16);
    const g = parseInt(l.color.slice(3, 5), 16);
    const b = parseInt(l.color.slice(5, 7), 16);
    return `${l.x}px ${l.y}px ${l.blur}px rgba(${r}, ${g}, ${b}, ${l.opacity})`;
  }).join(', ');
}

function Slider({ label, value, min, max, step = 1, onChange }: { 
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void;
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
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-concrete rounded-full appearance-none cursor-pointer accent-primary"
      />
    </div>
  );
}

export function TypographySandbox() {
  const [selectedType, setSelectedType] = useState<'xl' | 'l'>('xl');
  const [xlConfig, setXlConfig] = useState<TypographyConfig>(defaultXL);
  const [lConfig, setLConfig] = useState<TypographyConfig>(defaultL);
  const [xlLayers, setXlLayers] = useState<ShadowLayer[]>(() => parseShadow(defaultXL.textShadow));
  const [lLayers, setLLayers] = useState<ShadowLayer[]>(() => parseShadow(defaultL.textShadow));
  const [copied, setCopied] = useState(false);

  const currentConfig = selectedType === 'xl' ? xlConfig : lConfig;
  const setCurrentConfig = selectedType === 'xl' ? setXlConfig : setLConfig;
  const currentLayers = selectedType === 'xl' ? xlLayers : lLayers;
  const setCurrentLayers = selectedType === 'xl' ? setXlLayers : setLLayers;

  const updateLayer = (index: number, updates: Partial<ShadowLayer>) => {
    const newLayers = [...currentLayers];
    newLayers[index] = { ...newLayers[index], ...updates };
    setCurrentLayers(newLayers);
    setCurrentConfig(prev => ({ ...prev, textShadow: layersToCSS(newLayers) }));
  };

  const reset = () => {
    if (selectedType === 'xl') {
      setXlConfig(defaultXL);
      setXlLayers(parseShadow(defaultXL.textShadow));
    } else {
      setLConfig(defaultL);
      setLLayers(parseShadow(defaultL.textShadow));
    }
  };

  const cssOutput = useMemo(() => `/* Heading ${selectedType.toUpperCase()} - Neumorphic */
.heading-${selectedType}-neu {
  text-shadow: ${currentConfig.textShadow};
  letter-spacing: ${currentConfig.letterSpacing}px;
  font-weight: ${currentConfig.fontWeight};
}`, [selectedType, currentConfig]);

  const copyCSS = () => {
    navigator.clipboard.writeText(cssOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-semibold text-ink tracking-tight">Typography Sandbox</h2>
        <p className="text-muted-foreground text-sm">Add neumorphic text effects to headings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preview */}
        <div className="space-y-4">
          <div className="bg-background rounded-xl p-8 space-y-6">
            {/* Type Selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedType('xl')}
                className={cn(
                  'px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-wider transition-all',
                  selectedType === 'xl' ? 'bg-primary text-white' : 'bg-surface shadow-e1 text-ink/60'
                )}
              >
                Heading XL
              </button>
              <button
                onClick={() => setSelectedType('l')}
                className={cn(
                  'px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-wider transition-all',
                  selectedType === 'l' ? 'bg-primary text-white' : 'bg-surface shadow-e1 text-ink/60'
                )}
              >
                Heading L
              </button>
            </div>

            {/* Live Preview */}
            <div className="space-y-4">
              <h1 
                className={cn(
                  'text-ink',
                  selectedType === 'xl' ? 'text-4xl' : 'text-2xl'
                )}
                style={{
                  textShadow: currentConfig.textShadow,
                  letterSpacing: currentConfig.letterSpacing,
                  fontWeight: currentConfig.fontWeight,
                }}
              >
                {selectedType === 'xl' ? 'Heading Extra Large' : 'Heading Large'}
              </h1>
              <p className="text-muted-foreground text-sm">
                The quick brown fox jumps over the lazy dog
              </p>
            </div>
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
            <pre className="text-xs text-primary font-mono overflow-x-auto whitespace-pre-wrap">{cssOutput}</pre>
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {/* Typography Settings */}
          <div className="bg-surface rounded-lg shadow-e1 p-4 space-y-4">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Typography</h3>
            <div className="grid grid-cols-2 gap-4">
              <Slider 
                label="Letter Spacing" 
                value={currentConfig.letterSpacing} 
                min={-3} 
                max={3} 
                step={0.5}
                onChange={(v) => setCurrentConfig(prev => ({ ...prev, letterSpacing: v }))} 
              />
              <Slider 
                label="Font Weight" 
                value={currentConfig.fontWeight} 
                min={400} 
                max={800} 
                step={100}
                onChange={(v) => setCurrentConfig(prev => ({ ...prev, fontWeight: v }))} 
              />
            </div>
          </div>

          {/* Shadow Layers */}
          <div className="space-y-3">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Text Shadow Layers</h3>
            {currentLayers.map((layer, i) => (
              <div key={i} className="bg-surface rounded-lg shadow-e1 p-4 space-y-4">
                <span className="font-mono text-[10px] uppercase tracking-wider text-ink font-medium">
                  {i === 0 ? 'Highlight (Light)' : 'Shadow (Dark)'}
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <Slider label="X" value={layer.x} min={-5} max={5} onChange={(v) => updateLayer(i, { x: v })} />
                  <Slider label="Y" value={layer.y} min={-5} max={5} onChange={(v) => updateLayer(i, { y: v })} />
                  <Slider label="Blur" value={layer.blur} min={0} max={10} onChange={(v) => updateLayer(i, { blur: v })} />
                  <Slider 
                    label="Opacity" 
                    value={Math.round(layer.opacity * 100)} 
                    min={0} 
                    max={100} 
                    onChange={(v) => updateLayer(i, { opacity: v / 100 })} 
                  />
                  <div className="space-y-1 col-span-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Color</span>
                    <input
                      type="color"
                      value={layer.color}
                      onChange={(e) => updateLayer(i, { color: e.target.value })}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
