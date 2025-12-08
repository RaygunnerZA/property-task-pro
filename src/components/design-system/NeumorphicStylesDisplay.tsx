import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NeumorphicStyle {
  name: string;
  key: string;
  boxShadow: string;
  borderRadius: number;
  backgroundColor: string;
}

export const defaultNeumorphicStyles: NeumorphicStyle[] = [
  {
    name: 'Neu Floating Card',
    key: 'neu_floating_card',
    boxShadow: '6px 6px 14px 0 rgba(0,0,0,0.08), -4px -4px 10px 0 rgba(255,255,255,0.9), inset 2px 2px 4px 0 rgba(255,255,255,0.5)',
    borderRadius: 10,
    backgroundColor: '#F1EEE8',
  },
  {
    name: 'Neu Flat Card',
    key: 'neu_flat_card',
    boxShadow: '4px 4px 10px 0 rgba(0,0,0,0.06), -3px -3px 8px 0 rgba(255,255,255,0.8), inset 1px 1px 2px 0 rgba(255,255,255,0.4)',
    borderRadius: 8,
    backgroundColor: '#F1EEE8',
  },
  {
    name: 'Neu Flat Pressed',
    key: 'neu_flat_pressed',
    boxShadow: 'inset 3px 3px 8px 0 rgba(0,0,0,0.08), inset -2px -2px 6px 0 rgba(255,255,255,0.7)',
    borderRadius: 8,
    backgroundColor: '#F1EEE8',
  },
  {
    name: 'Neu Button Out',
    key: 'neu_button_out',
    boxShadow: '4px 4px 8px 0 rgba(0,0,0,0.1), -3px -3px 6px 0 rgba(255,255,255,0.95), inset 1px 1px 2px 0 rgba(255,255,255,0.6)',
    borderRadius: 10,
    backgroundColor: '#F1EEE8',
  },
  {
    name: 'Neu Button Pressed',
    key: 'neu_button_pressed',
    boxShadow: 'inset 4px 4px 8px 0 rgba(0,0,0,0.1), inset -3px -3px 6px 0 rgba(255,255,255,0.8)',
    borderRadius: 10,
    backgroundColor: '#F1EEE8',
  },
];

interface NeumorphicStylesDisplayProps {
  styles?: NeumorphicStyle[];
  onSelectStyle?: (style: NeumorphicStyle) => void;
}

export function NeumorphicStylesDisplay({ 
  styles = defaultNeumorphicStyles,
  onSelectStyle 
}: NeumorphicStylesDisplayProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (style: NeumorphicStyle) => {
    const css = `box-shadow: ${style.boxShadow};\nborder-radius: ${style.borderRadius}px;\nbackground-color: ${style.backgroundColor};`;
    navigator.clipboard.writeText(css);
    setCopied(style.key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-semibold text-ink tracking-tight">Neumorphic Styles</h2>
        <p className="text-muted-foreground text-sm">Preset shadow effects for the Filla design system</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {styles.map((style) => (
          <div
            key={style.key}
            className={cn(
              'group flex flex-col items-center p-4 rounded-lg cursor-pointer transition-all duration-200',
              'hover:scale-[1.02]'
            )}
            onClick={() => onSelectStyle?.(style)}
            style={{ backgroundColor: style.backgroundColor }}
          >
            {/* Preview */}
            <div
              className="w-20 h-20 mb-4 flex items-center justify-center"
              style={{
                boxShadow: style.boxShadow,
                borderRadius: style.borderRadius,
                backgroundColor: style.backgroundColor,
              }}
            >
              <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground">
                Preview
              </span>
            </div>

            {/* Name & Copy */}
            <div className="text-center space-y-2 w-full">
              <p className="font-semibold text-sm text-ink">{style.name}</p>
              <p className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground break-all">
                {style.key}
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard(style);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider bg-concrete/50 hover:bg-concrete text-ink/60 hover:text-ink transition-colors"
              >
                {copied === style.key ? (
                  <>
                    <Check className="w-3 h-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy CSS
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
