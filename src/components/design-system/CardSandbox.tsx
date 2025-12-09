import React, { useState, useMemo } from 'react';
import { Copy, Check, RotateCcw, Image as ImageIcon, Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CardConfig {
  backgroundColor: string;
  backgroundOpacity: number;
  noiseIntensity: number;
  borderRadius: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowBlur: number;
  shadowSpread: number;
  shadowColor: string;
  shadowOpacity: number;
  insetShadowOffsetX: number;
  insetShadowOffsetY: number;
  insetShadowBlur: number;
  insetShadowColor: string;
  insetShadowOpacity: number;
  borderWidth: number;
  borderColor: string;
  borderOpacity: number;
  padding: number;
}

const defaultConfig: CardConfig = {
  backgroundColor: '#F1EEE8',
  backgroundOpacity: 100,
  noiseIntensity: 0,
  borderRadius: 12,
  shadowOffsetX: 4,
  shadowOffsetY: 4,
  shadowBlur: 12,
  shadowSpread: 0,
  shadowColor: '#b8b5ae',
  shadowOpacity: 60,
  insetShadowOffsetX: -2,
  insetShadowOffsetY: -2,
  insetShadowBlur: 6,
  insetShadowColor: '#ffffff',
  insetShadowOpacity: 80,
  borderWidth: 1,
  borderColor: '#ffffff',
  borderOpacity: 40,
  padding: 16,
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

export function CardSandbox() {
  const [config, setConfig] = useState<CardConfig>(defaultConfig);
  const [copied, setCopied] = useState(false);
  const [committed, setCommitted] = useState(false);

  const update = <K extends keyof CardConfig>(key: K, value: CardConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const reset = () => setConfig(defaultConfig);

  const commitStyles = () => {
    localStorage.setItem('filla-committed-card-styles', JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('filla-card-styles-updated', { detail: config }));
    setCommitted(true);
    setTimeout(() => setCommitted(false), 2000);
  };

  const hexToRgba = (hex: string, opacity: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
  };

  const boxShadow = useMemo(() => {
    const outer = `${config.shadowOffsetX}px ${config.shadowOffsetY}px ${config.shadowBlur}px ${config.shadowSpread}px ${hexToRgba(config.shadowColor, config.shadowOpacity)}`;
    const inset = `inset ${config.insetShadowOffsetX}px ${config.insetShadowOffsetY}px ${config.insetShadowBlur}px ${hexToRgba(config.insetShadowColor, config.insetShadowOpacity)}`;
    return `${outer}, ${inset}`;
  }, [config]);

  const cssOutput = useMemo(() => `/* Card Styles */
.card {
  background-color: ${hexToRgba(config.backgroundColor, config.backgroundOpacity)};
  border-radius: ${config.borderRadius}px;
  padding: ${config.padding}px;
  border: ${config.borderWidth}px solid ${hexToRgba(config.borderColor, config.borderOpacity)};
  box-shadow: ${boxShadow};
  ${config.noiseIntensity > 0 ? `background-image: url('/textures/white-texture.jpg');
  background-blend-mode: overlay;
  background-size: ${100 - config.noiseIntensity}%;` : ''}
}`, [config, boxShadow]);

  const copyCSS = () => {
    navigator.clipboard.writeText(cssOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const cardStyle = {
    backgroundColor: hexToRgba(config.backgroundColor, config.backgroundOpacity),
    borderRadius: config.borderRadius,
    padding: config.padding,
    border: `${config.borderWidth}px solid ${hexToRgba(config.borderColor, config.borderOpacity)}`,
    boxShadow,
    backgroundImage: config.noiseIntensity > 0 ? `url('/textures/white-texture.jpg')` : 'none',
    backgroundBlendMode: 'overlay' as const,
    backgroundSize: `${100 - config.noiseIntensity}%`,
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-semibold text-ink tracking-tight">Card Sandbox</h2>
        <p className="text-muted-foreground text-sm">Customize card backgrounds, shadows, and textures</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Preview */}
        <div className="space-y-4">
          {/* Card Preview */}
          <div className="p-6 bg-transparent rounded-xl">
            <div style={cardStyle} className="max-w-sm">
              <div className="flex gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-mono uppercase">Task</span>
                    <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent text-[10px] font-mono uppercase">High</span>
                  </div>
                  <h4 className="font-display font-semibold text-ink">Sample Task Card</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    This is a preview of how your card styling will appear throughout the application.
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 2:00 PM
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Kitchen
                    </span>
                  </div>
                </div>
                <div className="w-20 h-20 rounded-lg bg-concrete/50 flex items-center justify-center shrink-0">
                  <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
                </div>
              </div>
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
              'Commit & Apply Card Styles'
            )}
          </button>
        </div>

        {/* Controls */}
        <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2">
          {/* Background */}
          <div className="bg-surface/50 rounded-lg shadow-e1 p-3 sm:p-4 space-y-4">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Background</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Color</span>
                <input
                  type="color"
                  value={config.backgroundColor}
                  onChange={(e) => update('backgroundColor', e.target.value)}
                  className="w-full h-8 rounded cursor-pointer"
                />
              </div>
              <Slider label="Opacity" value={config.backgroundOpacity} min={0} max={100} onChange={v => update('backgroundOpacity', v)} />
            </div>
            <Slider label="Noise Texture" value={config.noiseIntensity} min={0} max={80} onChange={v => update('noiseIntensity', v)} />
          </div>

          {/* Border */}
          <div className="bg-surface/50 rounded-lg shadow-e1 p-3 sm:p-4 space-y-4">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Border</h3>
            <div className="grid grid-cols-2 gap-4">
              <Slider label="Radius" value={config.borderRadius} min={0} max={32} onChange={v => update('borderRadius', v)} />
              <Slider label="Width" value={config.borderWidth} min={0} max={4} onChange={v => update('borderWidth', v)} />
              <div className="space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Color</span>
                <input
                  type="color"
                  value={config.borderColor}
                  onChange={(e) => update('borderColor', e.target.value)}
                  className="w-full h-8 rounded cursor-pointer"
                />
              </div>
              <Slider label="Opacity" value={config.borderOpacity} min={0} max={100} onChange={v => update('borderOpacity', v)} />
            </div>
            <Slider label="Padding" value={config.padding} min={8} max={32} onChange={v => update('padding', v)} />
          </div>

          {/* Outer Shadow */}
          <div className="bg-surface/50 rounded-lg shadow-e1 p-3 sm:p-4 space-y-4">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Outer Shadow</h3>
            <div className="grid grid-cols-2 gap-4">
              <Slider label="X Offset" value={config.shadowOffsetX} min={-20} max={20} onChange={v => update('shadowOffsetX', v)} />
              <Slider label="Y Offset" value={config.shadowOffsetY} min={-20} max={20} onChange={v => update('shadowOffsetY', v)} />
              <Slider label="Blur" value={config.shadowBlur} min={0} max={40} onChange={v => update('shadowBlur', v)} />
              <Slider label="Spread" value={config.shadowSpread} min={-10} max={10} onChange={v => update('shadowSpread', v)} />
              <div className="space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Color</span>
                <input
                  type="color"
                  value={config.shadowColor}
                  onChange={(e) => update('shadowColor', e.target.value)}
                  className="w-full h-8 rounded cursor-pointer"
                />
              </div>
              <Slider label="Opacity" value={config.shadowOpacity} min={0} max={100} onChange={v => update('shadowOpacity', v)} />
            </div>
          </div>

          {/* Inset Shadow */}
          <div className="bg-surface/50 rounded-lg shadow-e1 p-3 sm:p-4 space-y-4">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Inset Shadow (Highlight)</h3>
            <div className="grid grid-cols-2 gap-4">
              <Slider label="X Offset" value={config.insetShadowOffsetX} min={-20} max={20} onChange={v => update('insetShadowOffsetX', v)} />
              <Slider label="Y Offset" value={config.insetShadowOffsetY} min={-20} max={20} onChange={v => update('insetShadowOffsetY', v)} />
              <Slider label="Blur" value={config.insetShadowBlur} min={0} max={20} onChange={v => update('insetShadowBlur', v)} />
              <div className="space-y-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Color</span>
                <input
                  type="color"
                  value={config.insetShadowColor}
                  onChange={(e) => update('insetShadowColor', e.target.value)}
                  className="w-full h-8 rounded cursor-pointer"
                />
              </div>
              <Slider label="Opacity" value={config.insetShadowOpacity} min={0} max={100} onChange={v => update('insetShadowOpacity', v)} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
