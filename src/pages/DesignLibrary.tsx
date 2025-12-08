import React from 'react';
import { ColorPalette } from '@/components/design-system/ColorPalette';
import { TypographySection } from '@/components/design-system/TypographySection';
import { ButtonsSection } from '@/components/design-system/ButtonsSection';
import { ChipsSection } from '@/components/design-system/ChipsSection';
import { CalendarHeatMap } from '@/components/design-system/CalendarHeatMap';
import { CardsSection } from '@/components/design-system/CardsSection';
import { NavigationSection } from '@/components/design-system/NavigationSection';
import { TabsSection } from '@/components/design-system/TabsSection';
import { NeumorphismSandbox } from '@/components/design-system/NeumorphismSandbox';
import { ResponsiveDemo } from '@/components/design-system/ResponsiveDemo';
import { Palette, Type, MousePointer, Tag, Calendar, LayoutGrid, Navigation, Layers, SlidersHorizontal, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

const sections = [
  { id: 'colors', label: 'Colours', icon: Palette },
  { id: 'typography', label: 'Typography', icon: Type },
  { id: 'buttons', label: 'Buttons', icon: MousePointer },
  { id: 'chips', label: 'Chips', icon: Tag },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'cards', label: 'Cards', icon: LayoutGrid },
  { id: 'navigation', label: 'Navigation', icon: Navigation },
  { id: 'tabs', label: 'Tabs', icon: Layers },
  { id: 'sandbox', label: 'Sandbox', icon: SlidersHorizontal },
  { id: 'responsive', label: 'Responsive', icon: Monitor },
];

export default function DesignLibrary() {
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-concrete">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <span className="font-display text-xl font-bold text-white">F</span>
              </div>
              <div>
                <h1 className="font-display text-xl font-bold text-ink tracking-tight">Filla Design System</h1>
                <p className="text-xs text-muted-foreground">v3.3 Dimensional Paper Edition</p>
              </div>
            </div>
          </div>

          {/* Quick Nav */}
          <nav className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full whitespace-nowrap',
                    'font-mono text-[10px] uppercase tracking-wider',
                    'bg-surface shadow-e1 text-ink/70 hover:text-primary hover:shadow-e2 transition-all'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {section.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-16">
        <section id="colors">
          <ColorPalette />
        </section>

        <div className="h-px bg-concrete" />

        <section id="typography">
          <TypographySection />
        </section>

        <div className="h-px bg-concrete" />

        <section id="buttons">
          <ButtonsSection />
        </section>

        <div className="h-px bg-concrete" />

        <section id="chips">
          <ChipsSection />
        </section>

        <div className="h-px bg-concrete" />

        <section id="calendar">
          <CalendarHeatMap />
        </section>

        <div className="h-px bg-concrete" />

        <section id="cards">
          <CardsSection />
        </section>

        <div className="h-px bg-concrete" />

        <section id="navigation">
          <NavigationSection />
        </section>

        <div className="h-px bg-concrete" />

        <section id="tabs">
          <TabsSection />
        </section>

        <div className="h-px bg-concrete" />

        <section id="sandbox">
          <NeumorphismSandbox />
        </section>

        <div className="h-px bg-concrete" />

        <section id="responsive">
          <ResponsiveDemo />
        </section>

        {/* Footer */}
        <footer className="pt-8 pb-16 text-center">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Filla Design System • Built with React + Tailwind
          </p>
        </footer>
      </main>
    </div>
  );
}
