import React from 'react';

const typographyExamples = [
  {
    name: 'Heading XL',
    font: 'Inter Tight',
    className: 'font-display text-4xl font-bold tracking-tight heading-xl',
    sample: 'The quick brown fox',
  },
  {
    name: 'Heading L',
    font: 'Inter Tight',
    className: 'font-display text-2xl font-semibold tracking-tight heading-l',
    sample: 'The quick brown fox jumps',
  },
  {
    name: 'Heading M',
    font: 'Inter Tight',
    className: 'font-display text-lg font-semibold tracking-tight',
    sample: 'The quick brown fox jumps over',
  },
  {
    name: 'Body',
    font: 'Inter',
    className: 'font-sans text-base leading-relaxed',
    sample: 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.',
  },
  {
    name: 'Body Small',
    font: 'Inter',
    className: 'font-sans text-sm leading-relaxed',
    sample: 'The quick brown fox jumps over the lazy dog.',
  },
  {
    name: 'Caption',
    font: 'Inter',
    className: 'font-sans text-xs text-muted-foreground',
    sample: 'Caption text for smaller annotations',
  },
  {
    name: 'Mono / Metadata',
    font: 'JetBrains Mono',
    className: 'font-mono text-[11px] uppercase tracking-wider font-medium',
    sample: 'MON TUE WED THU FRI SAT SUN',
  },
  {
    name: 'Mono Numbers',
    font: 'JetBrains Mono',
    className: 'font-mono text-sm tabular-nums',
    sample: '0123456789 • 12:45 PM • €1,234.56',
  },
];

export function TypographySection() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-semibold text-ink tracking-tight heading-l">Typography</h2>
        <p className="text-muted-foreground text-sm">Inter Tight for headings, Inter for body, JetBrains Mono for metadata</p>
      </div>

      <div className="space-y-4">
        {typographyExamples.map((item) => (
          <div
            key={item.name}
            className="p-4 rounded-[8px] bg-surface shadow-e1 space-y-2"
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground bg-concrete/50 px-2 py-0.5 rounded-[5px]">
                {item.name}
              </span>
              <span className="text-xs text-muted-foreground">{item.font}</span>
            </div>
            <p className={`text-ink ${item.className}`}>{item.sample}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
