import React from 'react';
import { Smartphone, Tablet, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

const breakpoints = [
  {
    name: 'Mobile',
    icon: Smartphone,
    range: '≤ 640px',
    columns: 1,
    features: ['Single column layout', 'Bottom navigation', 'FAB centered', 'Hamburger menu', 'Vertical scroll'],
    color: 'bg-blue-500',
  },
  {
    name: 'Tablet',
    icon: Tablet,
    range: '641px – 1024px',
    columns: 2,
    features: ['Two column layout', 'Mobile nav + hamburger', 'Adaptive panels', 'Touch-optimized'],
    color: 'bg-amber-500',
  },
  {
    name: 'Desktop',
    icon: Monitor,
    range: '≥ 1025px',
    columns: 3,
    features: ['Left nav drawer (permanent)', 'Three column content', 'Dedicated calendar column', 'Hover interactions'],
    color: 'bg-green-500',
  },
];

function ColumnDemo({ columns }: { columns: number }) {
  const gridClass = columns === 1 ? 'grid-cols-1' : columns === 2 ? 'grid-cols-2' : 'grid-cols-3';
  
  return (
    <div className={cn('grid gap-2', gridClass)}>
      {Array.from({ length: columns }).map((_, i) => (
        <div
          key={i}
          className="h-16 rounded-lg bg-primary/20 flex items-center justify-center"
        >
          <span className="font-mono text-[10px] uppercase tracking-wider text-primary">
            Col {i + 1}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ResponsiveDemo() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-semibold text-ink tracking-tight">Responsive Breakpoints</h2>
        <p className="text-muted-foreground text-sm">Column rules for mobile, tablet, and desktop layouts</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {breakpoints.map((bp) => {
          const Icon = bp.icon;
          
          return (
            <div key={bp.name} className="bg-surface rounded-xl shadow-e2 overflow-hidden">
              {/* Header */}
              <div className={cn('p-4 text-white', bp.color)}>
                <div className="flex items-center gap-3">
                  <Icon className="w-6 h-6" />
                  <div>
                    <h3 className="font-semibold">{bp.name}</h3>
                    <p className="text-sm opacity-80">{bp.range}</p>
                  </div>
                </div>
              </div>

              {/* Column Demo */}
              <div className="p-4 border-b border-concrete">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
                  {bp.columns} Column{bp.columns > 1 ? 's' : ''}
                </p>
                <ColumnDemo columns={bp.columns} />
              </div>

              {/* Features */}
              <div className="p-4">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Features</p>
                <ul className="space-y-1.5">
                  {bp.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-ink/80">
                      <div className={cn('w-1.5 h-1.5 rounded-full', bp.color)} />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Demo */}
      <div className="bg-surface rounded-xl shadow-e2 p-6">
        <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-4">
          Live Responsive Grid (resize browser to see changes)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center border border-primary/10"
            >
              <span className="font-mono text-xs text-primary">Item {i + 1}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground text-center">
          <span className="sm:hidden">Mobile: 1 column</span>
          <span className="hidden sm:inline lg:hidden">Tablet: 2 columns</span>
          <span className="hidden lg:inline">Desktop: 3 columns</span>
        </p>
      </div>
    </section>
  );
}
