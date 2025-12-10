/**
 * Component Registry - Single source of truth for all UI components
 * Shows component name, live preview, and copy/paste CSS functionality
 */

import React, { useState } from 'react';
import { Copy, Check, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDesignTokens } from '@/hooks/useDesignTokens';

interface ComponentDef {
  name: string;
  category: string;
  cssClass: string;
  cssValue: string;
  preview: React.ReactNode;
}

function CopyButton({ css, onSave }: { css: string; onSave?: () => void }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(css);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex gap-1">
      <button
        onClick={handleCopy}
        className="p-1.5 rounded-[5px] bg-surface/80 shadow-e1 hover:shadow-e2 transition-all"
        title="Copy CSS"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {onSave && (
        <button
          onClick={onSave}
          className="p-1.5 rounded-[5px] bg-primary/20 shadow-e1 hover:shadow-e2 transition-all"
          title="Save to design system"
        >
          <Save className="w-3.5 h-3.5 text-primary-deep" />
        </button>
      )}
    </div>
  );
}

function ComponentCard({ component }: { component: ComponentDef }) {
  const cssOutput = `.${component.cssClass} {\n${component.cssValue}\n}`;
  
  return (
    <div className="bg-surface/50 rounded-[8px] shadow-e1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-concrete/50">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground bg-concrete/50 px-1.5 py-0.5 rounded-[5px]">
            {component.category}
          </span>
          <span className="font-mono text-[11px] font-medium text-ink">{component.name}</span>
        </div>
        <CopyButton css={cssOutput} />
      </div>
      
      {/* Preview */}
      <div className="p-4 flex items-center justify-center min-h-[80px]">
        {component.preview}
      </div>
      
      {/* CSS */}
      <div className="bg-ink/95 px-3 py-2">
        <pre className="text-[10px] text-primary font-mono overflow-x-auto whitespace-pre-wrap">
          <span className="text-white/50">.{component.cssClass}</span> {'{'}
          {'\n'}<span className="text-white/70 ml-2">{component.cssValue}</span>
          {'\n'}{'}'}
        </pre>
      </div>
    </div>
  );
}

export function ComponentRegistry() {
  const { tokens } = useDesignTokens();
  
  const components: ComponentDef[] = [
    // ==================== TYPOGRAPHY ====================
    {
      name: 'Heading XL',
      category: 'Typography',
      cssClass: 'heading-xl',
      cssValue: `  font-family: 'Inter Tight', sans-serif;
  font-size: 2.25rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  text-shadow: ${tokens.typography.headingXLShadow};`,
      preview: (
        <h1 
          className="font-display text-4xl font-bold tracking-tight text-ink"
          style={{ textShadow: tokens.typography.headingXLShadow }}
        >
          Heading XL
        </h1>
      ),
    },
    {
      name: 'Heading L',
      category: 'Typography',
      cssClass: 'heading-l',
      cssValue: `  font-family: 'Inter Tight', sans-serif;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.025em;
  text-shadow: ${tokens.typography.headingLShadow};`,
      preview: (
        <h2 
          className="font-display text-2xl font-semibold tracking-tight text-ink"
          style={{ textShadow: tokens.typography.headingLShadow }}
        >
          Heading L
        </h2>
      ),
    },
    {
      name: 'Heading M',
      category: 'Typography',
      cssClass: 'heading-m',
      cssValue: `  font-family: 'Inter Tight', sans-serif;
  font-size: 1.125rem;
  font-weight: 600;
  letter-spacing: -0.015em;`,
      preview: (
        <h3 className="font-display text-lg font-semibold tracking-tight text-ink">
          Heading M
        </h3>
      ),
    },
    {
      name: 'Body',
      category: 'Typography',
      cssClass: 'body-text',
      cssValue: `  font-family: 'Inter', sans-serif;
  font-size: 1rem;
  line-height: 1.625;`,
      preview: (
        <p className="font-sans text-base leading-relaxed text-ink">
          Body text paragraph
        </p>
      ),
    },
    {
      name: 'Mono / Metadata',
      category: 'Typography',
      cssClass: 'mono-text',
      cssValue: `  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;`,
      preview: (
        <span className="font-mono text-[11px] uppercase tracking-wider font-medium text-muted-foreground">
          MON TUE WED THU FRI
        </span>
      ),
    },
    
    // ==================== BUTTONS ====================
    {
      name: 'Button Primary',
      category: 'Button',
      cssClass: 'btn-primary',
      cssValue: `  background: ${tokens.buttons.primary.background};
  color: ${tokens.buttons.primary.text};
  border-radius: ${tokens.buttons.primary.radius}px;
  box-shadow: ${tokens.buttons.primary.shadow};`,
      preview: (
        <button 
          className="px-4 py-2 font-medium text-sm"
          style={{
            background: tokens.buttons.primary.background,
            color: tokens.buttons.primary.text,
            borderRadius: `${tokens.buttons.primary.radius}px`,
            boxShadow: tokens.buttons.primary.shadow,
          }}
        >
          Primary Button
        </button>
      ),
    },
    {
      name: 'Button Secondary',
      category: 'Button',
      cssClass: 'btn-secondary',
      cssValue: `  background: ${tokens.buttons.secondary.background};
  color: ${tokens.buttons.secondary.text};
  border-radius: ${tokens.buttons.secondary.radius}px;
  box-shadow: ${tokens.buttons.secondary.shadow};`,
      preview: (
        <button 
          className="px-4 py-2 font-medium text-sm"
          style={{
            background: tokens.buttons.secondary.background,
            color: tokens.buttons.secondary.text,
            borderRadius: `${tokens.buttons.secondary.radius}px`,
            boxShadow: tokens.buttons.secondary.shadow,
          }}
        >
          Secondary Button
        </button>
      ),
    },
    {
      name: 'Button Danger',
      category: 'Button',
      cssClass: 'btn-danger',
      cssValue: `  background: ${tokens.buttons.danger.background};
  color: ${tokens.buttons.danger.text};
  border-radius: ${tokens.buttons.danger.radius}px;
  box-shadow: ${tokens.buttons.danger.shadow};`,
      preview: (
        <button 
          className="px-4 py-2 font-medium text-sm"
          style={{
            background: tokens.buttons.danger.background,
            color: tokens.buttons.danger.text,
            borderRadius: `${tokens.buttons.danger.radius}px`,
            boxShadow: tokens.buttons.danger.shadow,
          }}
        >
          Danger Button
        </button>
      ),
    },
    
    // ==================== CHIPS ====================
    {
      name: 'Filter Chip (Active)',
      category: 'Chip',
      cssClass: 'chip-filter-active',
      cssValue: `  background: ${tokens.chips.filter.activeBackground};
  color: ${tokens.chips.filter.activeText};
  border-radius: 5px;
  box-shadow: ${tokens.chips.filter.shadow};`,
      preview: (
        <span 
          className="inline-flex items-center px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider font-medium"
          style={{
            background: tokens.chips.filter.activeBackground,
            color: tokens.chips.filter.activeText,
            borderRadius: '5px',
            boxShadow: tokens.chips.filter.shadow,
          }}
        >
          Active
        </span>
      ),
    },
    {
      name: 'Filter Chip (Inactive)',
      category: 'Chip',
      cssClass: 'chip-filter-inactive',
      cssValue: `  background: ${tokens.chips.filter.inactiveBackground};
  color: ${tokens.chips.filter.inactiveText};
  border-radius: 5px;
  box-shadow: ${tokens.chips.filter.shadow};`,
      preview: (
        <span 
          className="inline-flex items-center px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider font-medium"
          style={{
            background: tokens.chips.filter.inactiveBackground,
            color: tokens.chips.filter.inactiveText,
            borderRadius: '5px',
            boxShadow: tokens.chips.filter.shadow,
          }}
        >
          Inactive
        </span>
      ),
    },
    {
      name: 'Status Chip (Success)',
      category: 'Chip',
      cssClass: 'chip-status-success',
      cssValue: `  background: hsl(var(--success) / 0.3);
  color: #166534;
  border-radius: 5px;`,
      preview: (
        <span className="inline-flex items-center px-3 py-1.5 rounded-[5px] font-mono text-[11px] uppercase tracking-wider font-medium bg-success/30 text-green-800">
          Compliant
        </span>
      ),
    },
    {
      name: 'Status Chip (Warning)',
      category: 'Chip',
      cssClass: 'chip-status-warning',
      cssValue: `  background: hsl(var(--warning) / 0.5);
  color: #92400e;
  border-radius: 5px;`,
      preview: (
        <span className="inline-flex items-center px-3 py-1.5 rounded-[5px] font-mono text-[11px] uppercase tracking-wider font-medium bg-warning/50 text-amber-800">
          Pending
        </span>
      ),
    },
    {
      name: 'Status Chip (Danger)',
      category: 'Chip',
      cssClass: 'chip-status-danger',
      cssValue: `  background: hsl(var(--destructive) / 0.2);
  color: #991b1b;
  border-radius: 5px;`,
      preview: (
        <span className="inline-flex items-center px-3 py-1.5 rounded-[5px] font-mono text-[11px] uppercase tracking-wider font-medium bg-destructive/20 text-red-800">
          Overdue
        </span>
      ),
    },
    {
      name: 'Priority Chip (Low)',
      category: 'Chip',
      cssClass: 'chip-priority-low',
      cssValue: `  background: hsl(var(--concrete));
  color: hsl(var(--ink) / 0.6);
  border-radius: 5px;`,
      preview: (
        <span className="inline-flex items-center px-2.5 py-1 rounded-[5px] font-mono text-[10px] uppercase tracking-wider font-medium bg-concrete text-ink/60">
          Low
        </span>
      ),
    },
    {
      name: 'Priority Chip (Normal)',
      category: 'Chip',
      cssClass: 'chip-priority-normal',
      cssValue: `  background: hsl(var(--primary) / 0.3);
  color: hsl(var(--primary-deep));
  border-radius: 5px;`,
      preview: (
        <span className="inline-flex items-center px-2.5 py-1 rounded-[5px] font-mono text-[10px] uppercase tracking-wider font-medium bg-primary/30 text-primary-deep">
          Normal
        </span>
      ),
    },
    {
      name: 'Priority Chip (High)',
      category: 'Chip',
      cssClass: 'chip-priority-high',
      cssValue: `  background: hsl(var(--accent) / 0.2);
  color: hsl(var(--accent));
  border-radius: 5px;`,
      preview: (
        <span className="inline-flex items-center px-2.5 py-1 rounded-[5px] font-mono text-[10px] uppercase tracking-wider font-medium bg-accent/20 text-accent">
          High
        </span>
      ),
    },
    
    // ==================== SHADOWS ====================
    {
      name: 'Shadow E1 (Card)',
      category: 'Shadow',
      cssClass: 'shadow-e1',
      cssValue: `  box-shadow: ${tokens.shadows.e1};`,
      preview: (
        <div 
          className="w-24 h-16 rounded-[8px] bg-surface"
          style={{ boxShadow: tokens.shadows.e1 }}
        />
      ),
    },
    {
      name: 'Shadow E2 (Section)',
      category: 'Shadow',
      cssClass: 'shadow-e2',
      cssValue: `  box-shadow: ${tokens.shadows.e2};`,
      preview: (
        <div 
          className="w-24 h-16 rounded-[8px] bg-surface"
          style={{ boxShadow: tokens.shadows.e2 }}
        />
      ),
    },
    {
      name: 'Shadow E3 (Modal)',
      category: 'Shadow',
      cssClass: 'shadow-e3',
      cssValue: `  box-shadow: ${tokens.shadows.e3};`,
      preview: (
        <div 
          className="w-24 h-16 rounded-[8px] bg-surface"
          style={{ boxShadow: tokens.shadows.e3 }}
        />
      ),
    },
    {
      name: 'Shadow Engraved',
      category: 'Shadow',
      cssClass: 'shadow-engraved',
      cssValue: `  box-shadow: ${tokens.shadows.engraved};`,
      preview: (
        <div 
          className="w-24 h-16 rounded-[8px] bg-surface"
          style={{ boxShadow: tokens.shadows.engraved }}
        />
      ),
    },
    
    // ==================== SEGMENTS ====================
    {
      name: 'Segment Control',
      category: 'Control',
      cssClass: 'segment-control',
      cssValue: `  /* Track */
  background: ${tokens.segments.trackBackground};
  border-radius: ${tokens.segments.trackRadius}px;
  box-shadow: ${tokens.segments.trackShadow};
  
  /* Active Button */
  .active {
    background: ${tokens.segments.activeBackground};
    border-radius: ${tokens.segments.buttonRadius}px;
    box-shadow: ${tokens.segments.activeShadow};
  }`,
      preview: (
        <div 
          className="inline-flex p-1"
          style={{
            background: tokens.segments.trackBackground,
            borderRadius: `${tokens.segments.trackRadius}px`,
            boxShadow: tokens.segments.trackShadow,
          }}
        >
          <span 
            className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider"
            style={{
              background: tokens.segments.activeBackground,
              color: tokens.segments.activeText,
              borderRadius: `${tokens.segments.buttonRadius}px`,
              boxShadow: tokens.segments.activeShadow,
            }}
          >
            Tab 1
          </span>
          <span 
            className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider"
            style={{ color: tokens.segments.buttonText }}
          >
            Tab 2
          </span>
        </div>
      ),
    },
    
    // ==================== CARDS ====================
    {
      name: 'Card Flat',
      category: 'Card',
      cssClass: 'card-flat',
      cssValue: `  background-color: rgba(241, 238, 232, 0.49);
  background-image: url('/textures/white-texture.jpg');
  background-blend-mode: overlay;
  background-size: 75%;
  border-radius: 8px;
  box-shadow: ${tokens.shadows.e1};`,
      preview: (
        <div className="w-32 h-20 rounded-[8px] bg-card-flat shadow-e1" />
      ),
    },
    {
      name: 'Card Section',
      category: 'Card',
      cssClass: 'card-section',
      cssValue: `  background-color: rgba(182, 184, 164, 0.74);
  background-image: url('/textures/white-texture.jpg');
  background-blend-mode: overlay;
  background-size: 68%;
  border-radius: 8px;
  box-shadow: ${tokens.shadows.e2};`,
      preview: (
        <div className="w-32 h-20 rounded-[8px] bg-section-flat shadow-e2" />
      ),
    },
  ];
  
  // Group by category
  const grouped = components.reduce((acc, comp) => {
    if (!acc[comp.category]) acc[comp.category] = [];
    acc[comp.category].push(comp);
    return acc;
  }, {} as Record<string, ComponentDef[]>);
  
  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <h2 
          className="font-display text-2xl font-semibold text-ink tracking-tight"
          style={{ textShadow: tokens.typography.headingLShadow }}
        >
          Component Registry
        </h2>
        <p className="text-muted-foreground text-sm">
          Single source of truth for all UI components. Copy CSS to use anywhere.
        </p>
      </div>
      
      {Object.entries(grouped).map(([category, comps]) => (
        <div key={category} className="space-y-4">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground border-b border-concrete pb-2">
            {category}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {comps.map((comp) => (
              <ComponentCard key={comp.cssClass} component={comp} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
