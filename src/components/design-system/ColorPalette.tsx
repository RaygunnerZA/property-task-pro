import React from 'react';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

const colors = [
  { name: 'Primary', token: 'primary', hsl: '182 29% 63%', hex: '#8EC9CE' },
  { name: 'Primary Deep', token: 'primary-deep', hsl: '182 23% 56%', hex: '#71AEB3' },
  { name: 'Accent', token: 'accent', hsl: '16 83% 56%', hex: '#EB6834' },
  { name: 'Background', token: 'background', hsl: '40 20% 94%', hex: '#F1EEE8' },
  { name: 'Surface', token: 'surface', hsl: '0 0% 100%', hex: '#FFFFFF' },
  { name: 'Concrete', token: 'concrete', hsl: '40 12% 88%', hex: '#E3DFD7' },
  { name: 'Ink', token: 'ink', hsl: '248 15% 18%', hex: '#2A293E' },
  { name: 'Text Muted', token: 'muted-foreground', hsl: '40 2% 55%', hex: '#8C8C85' },
  { name: 'Danger', token: 'destructive', hsl: '0 84% 60%', hex: '#EF4444' },
  { name: 'Warning', token: 'warning', hsl: '43 100% 85%', hex: '#FFE9B2' },
  { name: 'Success', token: 'success', hsl: '145 62% 85%', hex: '#C1F1D6' },
  { name: 'Signal', token: 'signal', hsl: '30 100% 91%', hex: '#FFE4D0' },
];

export function ColorPalette() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, name: string) => {
    navigator.clipboard.writeText(text);
    setCopied(name);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-semibold text-ink tracking-tight heading-l">Colour Palette</h2>
        <p className="text-muted-foreground text-sm">Core tokens for the Filla visual language</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {colors.map((color) => (
          <div
            key={color.token}
            className="group rounded-lg overflow-hidden shadow-e1 bg-surface"
          >
            <div
              className="h-20 w-full relative"
              style={{ backgroundColor: color.hex }}
            >
              <button
                onClick={() => copyToClipboard(color.hex, color.name)}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-white/80 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {copied === color.name ? (
                  <Check className="w-3.5 h-3.5 text-green-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-ink/60" />
                )}
              </button>
            </div>
            <div className="p-3 space-y-1">
              <p className="font-semibold text-sm text-ink">{color.name}</p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {color.token}
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">{color.hex}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
