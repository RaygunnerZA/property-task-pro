/**
 * Unified Token Sandbox
 * Central editor for all design tokens with live preview and persistence
 */

import React, { useState, useMemo } from 'react';
import { Copy, Check, RotateCcw, Save, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDesignTokens } from '@/hooks/useDesignTokens';

type TabType = 'colors' | 'shadows' | 'buttons' | 'chips' | 'calendar' | 'typography';

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
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-concrete rounded-full appearance-none cursor-pointer accent-primary"
      />
    </div>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  // Handle HSL format conversion for display
  const displayValue = value.startsWith('#') ? value : hslToHex(value);
  
  return (
    <div className="space-y-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-8 rounded cursor-pointer border-0"
        />
        <span className="font-mono text-[10px] text-ink/60">{value}</span>
      </div>
    </div>
  );
}

function hslToHex(hsl: string): string {
  // Parse "182 29% 63%" format
  const parts = hsl.split(' ').map(p => parseFloat(p.replace('%', '')));
  if (parts.length !== 3) return '#808080';
  
  const [h, s, l] = parts;
  const sNorm = s / 100;
  const lNorm = l / 100;
  
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = lNorm - c / 2;
  
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  
  if (max === min) return `0 0% ${Math.round(l * 100)}%`;
  
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function UnifiedTokenSandbox() {
  const { tokens, setToken, setTokens, resetTokens, resetAll, commitTokens, hasChanges } = useDesignTokens();
  const [activeTab, setActiveTab] = useState<TabType>('colors');
  const [copied, setCopied] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('primary');

  const handleCommit = () => {
    commitTokens();
    setCommitted(true);
    setTimeout(() => setCommitted(false), 2000);
  };

  const handleCopyCSS = () => {
    const css = generateCSS(tokens);
    navigator.clipboard.writeText(css);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const generateCSS = (t: typeof tokens) => {
    return `/* Filla Design Tokens - Generated */
:root {
  --background: ${t.colors.background};
  --foreground: ${t.colors.foreground};
  --primary: ${t.colors.primary};
  --primary-deep: ${t.colors.primaryDeep};
  --accent: ${t.colors.accent};
  --muted: ${t.colors.muted};
  --muted-foreground: ${t.colors.mutedForeground};
  --border: ${t.colors.border};
  
  --radius-sharp: ${t.radii.sharp}px;
  --radius-card: ${t.radii.card}px;
  --radius-button: ${t.radii.button}px;
}

.shadow-e1 { box-shadow: ${t.shadows.e1}; }
.shadow-e2 { box-shadow: ${t.shadows.e2}; }
.shadow-engraved { box-shadow: ${t.shadows.engraved}; }
`;
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-semibold text-ink tracking-tight">Design Token Editor</h2>
        <p className="text-muted-foreground text-sm">
          Edit tokens live. Changes apply globally. Click "Commit" to save.
        </p>
      </div>

      {/* Status Bar */}
      {hasChanges && (
        <div className="flex items-center gap-2 px-4 py-2 bg-warning/20 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
          <span className="text-sm text-warning-foreground">Unsaved changes</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2">
        {(['colors', 'shadows', 'buttons', 'chips', 'calendar', 'typography'] as TabType[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 rounded-lg font-mono text-[10px] uppercase tracking-wider transition-all',
              activeTab === tab ? 'bg-primary text-white shadow-primary-btn' : 'bg-surface/80 shadow-e1 text-ink/60 hover:text-ink'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Controls Panel */}
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
          {activeTab === 'colors' && (
            <div className="space-y-4">
              <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Color Tokens</h3>
              <div className="grid grid-cols-2 gap-4">
                <ColorInput 
                  label="Primary" 
                  value={tokens.colors.primary}
                  onChange={(v) => setToken('colors', 'primary', hexToHsl(v))}
                />
                <ColorInput 
                  label="Primary Deep" 
                  value={tokens.colors.primaryDeep}
                  onChange={(v) => setToken('colors', 'primaryDeep', hexToHsl(v))}
                />
                <ColorInput 
                  label="Accent" 
                  value={tokens.colors.accent}
                  onChange={(v) => setToken('colors', 'accent', hexToHsl(v))}
                />
                <ColorInput 
                  label="Background" 
                  value={tokens.colors.background}
                  onChange={(v) => setToken('colors', 'background', hexToHsl(v))}
                />
                <ColorInput 
                  label="Border" 
                  value={tokens.colors.border}
                  onChange={(v) => setToken('colors', 'border', hexToHsl(v))}
                />
                <ColorInput 
                  label="Muted" 
                  value={tokens.colors.muted}
                  onChange={(v) => setToken('colors', 'muted', hexToHsl(v))}
                />
              </div>
              
              <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground pt-4">Radii</h3>
              <div className="grid grid-cols-2 gap-4">
                <Slider label="Sharp" value={tokens.radii.sharp} min={0} max={20} onChange={(v) => setToken('radii', 'sharp', v)} />
                <Slider label="Card" value={tokens.radii.card} min={0} max={24} onChange={(v) => setToken('radii', 'card', v)} />
                <Slider label="Button" value={tokens.radii.button} min={0} max={20} onChange={(v) => setToken('radii', 'button', v)} />
              </div>
            </div>
          )}

          {activeTab === 'buttons' && (
            <div className="space-y-4">
              {(['primary', 'secondary', 'ghost', 'danger'] as const).map(variant => (
                <div key={variant} className="border border-concrete/50 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedSection(expandedSection === variant ? null : variant)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-surface/50"
                  >
                    <span className="font-mono text-xs uppercase tracking-wider text-ink">{variant} Button</span>
                    {expandedSection === variant ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  
                  {expandedSection === variant && (
                    <div className="p-4 space-y-4 bg-background/50">
                      <ColorInput
                        label="Background"
                        value={tokens.buttons[variant].background}
                        onChange={(v) => setTokens('buttons', { [variant]: { ...tokens.buttons[variant], background: v } } as any)}
                      />
                      <ColorInput
                        label="Text"
                        value={tokens.buttons[variant].text}
                        onChange={(v) => setTokens('buttons', { [variant]: { ...tokens.buttons[variant], text: v } } as any)}
                      />
                      <Slider
                        label="Border Radius"
                        value={tokens.buttons[variant].radius}
                        min={0}
                        max={20}
                        onChange={(v) => setTokens('buttons', { [variant]: { ...tokens.buttons[variant], radius: v } } as any)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'chips' && (
            <div className="space-y-4">
              <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Filter Chip</h3>
              <ColorInput
                label="Active Background"
                value={tokens.chips.filter.activeBackground}
                onChange={(v) => setTokens('chips', { filter: { ...tokens.chips.filter, activeBackground: v } })}
              />
              <ColorInput
                label="Active Text"
                value={tokens.chips.filter.activeText}
                onChange={(v) => setTokens('chips', { filter: { ...tokens.chips.filter, activeText: v } })}
              />
              <ColorInput
                label="Inactive Background"
                value={tokens.chips.filter.inactiveBackground}
                onChange={(v) => setTokens('chips', { filter: { ...tokens.chips.filter, inactiveBackground: v } })}
              />
              <Slider
                label="Border Radius"
                value={tokens.chips.filter.radius}
                min={0}
                max={50}
                onChange={(v) => setTokens('chips', { filter: { ...tokens.chips.filter, radius: v } })}
              />
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="space-y-4">
              <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Calendar Tokens</h3>
              <Slider label="Cell Radius" value={tokens.calendar.cellRadius} min={0} max={24} onChange={(v) => setToken('calendar', 'cellRadius', v)} />
              <Slider label="Cell Size" value={tokens.calendar.cellSize} min={28} max={56} onChange={(v) => setToken('calendar', 'cellSize', v)} />
              <Slider label="Gap" value={tokens.calendar.gap} min={0} max={12} onChange={(v) => setToken('calendar', 'gap', v)} />
              
              <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground pt-4">Heat Colors</h3>
              <ColorInput label="Heat Low" value={tokens.calendar.heatLow} onChange={(v) => setToken('calendar', 'heatLow', hexToHsl(v))} />
              <ColorInput label="Heat Medium" value={tokens.calendar.heatMed} onChange={(v) => setToken('calendar', 'heatMed', hexToHsl(v))} />
              <ColorInput label="Heat High" value={tokens.calendar.heatHigh} onChange={(v) => setToken('calendar', 'heatHigh', hexToHsl(v))} />
            </div>
          )}

          {activeTab === 'shadows' && (
            <div className="space-y-4">
              <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Shadow Presets</h3>
              <p className="text-xs text-muted-foreground">Edit shadow values directly (advanced)</p>
              
              {(['e1', 'e2', 'e3', 'engraved', 'primaryBtn'] as const).map(key => (
                <div key={key} className="space-y-1">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{key}</label>
                  <textarea
                    value={tokens.shadows[key]}
                    onChange={(e) => setToken('shadows', key, e.target.value)}
                    className="w-full h-20 p-2 text-xs font-mono bg-surface border border-concrete rounded-lg resize-none"
                  />
                </div>
              ))}
            </div>
          )}

          {activeTab === 'typography' && (
            <div className="space-y-4">
              <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Typography</h3>
              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Heading XL Shadow</label>
                <input
                  type="text"
                  value={tokens.typography.headingXLShadow}
                  onChange={(e) => setToken('typography', 'headingXLShadow', e.target.value)}
                  className="w-full p-2 text-xs font-mono bg-surface border border-concrete rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Heading L Shadow</label>
                <input
                  type="text"
                  value={tokens.typography.headingLShadow}
                  onChange={(e) => setToken('typography', 'headingLShadow', e.target.value)}
                  className="w-full p-2 text-xs font-mono bg-surface border border-concrete rounded-lg"
                />
              </div>
            </div>
          )}
        </div>

        {/* Preview Panel */}
        <div className="space-y-4">
          {/* Live Preview */}
          <div className="bg-transparent rounded-xl p-8 border border-dashed border-concrete/50 min-h-[300px] flex flex-col items-center justify-center gap-6">
            {activeTab === 'colors' && (
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(tokens.colors).slice(0, 6).map(([key, value]) => (
                  <div key={key} className="text-center">
                    <div 
                      className="w-12 h-12 rounded-lg shadow-e1 mx-auto mb-2"
                      style={{ backgroundColor: `hsl(${value})` }}
                    />
                    <span className="font-mono text-[9px] uppercase text-muted-foreground">{key}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'buttons' && (
              <div className="flex flex-wrap gap-4 justify-center">
                {(['primary', 'secondary', 'ghost', 'danger'] as const).map(variant => (
                  <button
                    key={variant}
                    className="px-5 py-3 text-sm font-semibold transition-all"
                    style={{
                      backgroundColor: tokens.buttons[variant].background,
                      color: tokens.buttons[variant].text,
                      borderRadius: tokens.buttons[variant].radius,
                      boxShadow: tokens.buttons[variant].shadow,
                    }}
                  >
                    {variant}
                  </button>
                ))}
              </div>
            )}

            {activeTab === 'chips' && (
              <div className="flex gap-2">
                <span
                  className="px-3 py-1.5 text-xs font-medium"
                  style={{
                    backgroundColor: tokens.chips.filter.activeBackground,
                    color: tokens.chips.filter.activeText,
                    borderRadius: tokens.chips.filter.radius,
                    boxShadow: tokens.chips.filter.shadow,
                  }}
                >
                  Active
                </span>
                <span
                  className="px-3 py-1.5 text-xs font-medium"
                  style={{
                    backgroundColor: tokens.chips.filter.inactiveBackground,
                    color: tokens.chips.filter.inactiveText,
                    borderRadius: tokens.chips.filter.radius,
                  }}
                >
                  Inactive
                </span>
              </div>
            )}

            {activeTab === 'calendar' && (
              <div className="flex gap-1" style={{ gap: tokens.calendar.gap }}>
                {[1, 2, 3, 4, 5, 6, 7].map(day => (
                  <div
                    key={day}
                    className="flex items-center justify-center shadow-e1"
                    style={{
                      width: tokens.calendar.cellSize,
                      height: tokens.calendar.cellSize,
                      borderRadius: tokens.calendar.cellRadius,
                      backgroundColor: day === 4 ? `hsl(${tokens.calendar.heatHigh})` : 
                                      day % 2 === 0 ? `hsl(${tokens.calendar.heatMed})` : 
                                      `hsl(${tokens.calendar.heatLow})`,
                      fontFamily: tokens.calendar.dateFont,
                    }}
                  >
                    <span className="font-mono text-xs text-white">{day}</span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'shadows' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="w-24 h-24 rounded-lg bg-surface shadow-e1 flex items-center justify-center">
                  <span className="font-mono text-[9px] text-muted-foreground">E1</span>
                </div>
                <div className="w-24 h-24 rounded-lg bg-surface shadow-e2 flex items-center justify-center">
                  <span className="font-mono text-[9px] text-muted-foreground">E2</span>
                </div>
                <div className="w-24 h-24 rounded-lg bg-surface shadow-engraved flex items-center justify-center">
                  <span className="font-mono text-[9px] text-muted-foreground">Engraved</span>
                </div>
                <div className="w-24 h-24 rounded-lg bg-surface shadow-e3 flex items-center justify-center">
                  <span className="font-mono text-[9px] text-muted-foreground">E3</span>
                </div>
              </div>
            )}

            {activeTab === 'typography' && (
              <div className="text-center space-y-4">
                <h1 
                  className="text-4xl font-bold text-ink"
                  style={{ textShadow: tokens.typography.headingXLShadow }}
                >
                  Heading XL
                </h1>
                <h2 
                  className="text-2xl font-semibold text-ink"
                  style={{ textShadow: tokens.typography.headingLShadow }}
                >
                  Heading Large
                </h2>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => resetTokens(activeTab as any)}
              className="flex-1 py-3 rounded-lg font-mono text-sm uppercase tracking-wider bg-surface shadow-e1 text-ink/60 hover:text-ink transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" /> Reset {activeTab}
            </button>
            <button
              onClick={handleCopyCSS}
              className="py-3 px-4 rounded-lg bg-surface shadow-e1 text-ink/60 hover:text-ink transition-all"
            >
              {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Commit Button */}
          <button
            onClick={handleCommit}
            disabled={!hasChanges}
            className={cn(
              'w-full py-3 rounded-lg font-mono text-sm uppercase tracking-wider font-medium transition-all flex items-center justify-center gap-2',
              hasChanges
                ? 'bg-primary text-white hover:bg-primary-deep shadow-primary-btn'
                : 'bg-concrete text-ink/40 cursor-not-allowed'
            )}
          >
            {committed ? (
              <><Check className="w-4 h-4" /> Tokens Saved!</>
            ) : (
              <><Save className="w-4 h-4" /> Commit & Apply Globally</>
            )}
          </button>

          {/* Reset All */}
          <button
            onClick={resetAll}
            className="w-full py-2 text-xs font-mono uppercase tracking-wider text-destructive hover:underline"
          >
            Reset All Tokens to Defaults
          </button>
        </div>
      </div>
    </section>
  );
}
