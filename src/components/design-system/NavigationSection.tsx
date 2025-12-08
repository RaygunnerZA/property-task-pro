import React, { useState } from 'react';
import { 
  LayoutDashboard, CheckSquare, Calendar, Building2, Grid3X3, 
  FolderOpen, ShieldCheck, Zap, LineChart, Bell, Settings, 
  LogOut, Plus, Camera, Menu, Home, Inbox
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', hasAdd: false },
  { icon: CheckSquare, label: 'Tasks', hasAdd: true },
  { icon: Calendar, label: 'Schedule', hasAdd: true },
  { icon: Building2, label: 'Properties', hasAdd: true },
  { icon: Grid3X3, label: 'Spaces', hasAdd: true },
  { icon: FolderOpen, label: 'Assets', hasAdd: true },
  { icon: ShieldCheck, label: 'Compliance', hasAdd: true },
  { divider: true },
  { icon: Zap, label: 'Automations', hasAdd: false },
  { icon: LineChart, label: 'Insights', hasAdd: false },
  { divider: true },
  { icon: Bell, label: 'Notifications', hasAdd: false },
  { icon: Settings, label: 'Settings', hasAdd: false },
  { icon: LogOut, label: 'Sign Out', hasAdd: false },
];

const mobileNavItems = [
  { icon: Home, label: 'Home' },
  { icon: CheckSquare, label: 'Tasks' },
  { icon: Inbox, label: 'Inbox' },
  { icon: Calendar, label: 'Schedule' },
  { icon: Menu, label: 'More' },
];

function DesktopSidebar() {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState('Dashboard');

  return (
    <div className="w-64 bg-[#3F3B4A] rounded-xl p-4 text-white/90">
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 py-4 mb-4">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <span className="font-display font-bold text-white">F</span>
        </div>
        <span className="font-display font-semibold text-lg">Filla</span>
      </div>

      {/* Nav Items */}
      <nav className="space-y-1">
        {navItems.map((item, i) => {
          if ('divider' in item) {
            return <div key={i} className="h-px bg-white/10 my-3" />;
          }
          const Icon = item.icon;
          const isActive = activeItem === item.label;
          const isHovered = hoveredItem === item.label;

          return (
            <button
              key={item.label}
              onClick={() => setActiveItem(item.label)}
              onMouseEnter={() => setHoveredItem(item.label)}
              onMouseLeave={() => setHoveredItem(null)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all',
                isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              {item.hasAdd && (
                <Plus 
                  className={cn(
                    'w-4 h-4 transition-opacity',
                    isHovered ? 'opacity-70' : 'opacity-0'
                  )} 
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Org Switcher */}
      <div className="mt-6 pt-4 border-t border-white/10">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
          <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center">
            <span className="text-xs font-medium">AC</span>
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-medium text-white">Acme Properties</p>
            <p className="text-xs text-white/50">12 properties</p>
          </div>
        </button>
      </div>
    </div>
  );
}

function MobileNav() {
  const [activeItem, setActiveItem] = useState('Home');

  return (
    <div className="bg-surface rounded-t-2xl shadow-e3 px-2 py-3 flex justify-around items-center max-w-md mx-auto">
      {mobileNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeItem === item.label;

        return (
          <button
            key={item.label}
            onClick={() => setActiveItem(item.label)}
            className="flex flex-col items-center gap-1 p-2"
          >
            <Icon 
              className={cn(
                'w-6 h-6 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )} 
            />
            <span 
              className={cn(
                'font-mono text-[9px] uppercase tracking-wider',
                isActive ? 'text-primary font-medium' : 'text-muted-foreground'
              )}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function FABDemo() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="relative h-32 flex items-end justify-center pb-4">
      {/* Expanded buttons */}
      {expanded && (
        <div className="absolute bottom-20 flex flex-col gap-3 items-center animate-fade-in">
          <button className="w-12 h-12 rounded-full bg-surface shadow-e2 flex items-center justify-center text-primary hover:shadow-e3 transition-shadow">
            <Camera className="w-5 h-5" />
          </button>
          <button className="w-12 h-12 rounded-full bg-surface shadow-e2 flex items-center justify-center text-primary hover:shadow-e3 transition-shadow">
            <CheckSquare className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Main FAB */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-14 h-14 rounded-full flex items-center justify-center transition-all',
          'shadow-[0_8px_24px_rgba(235,104,52,0.4),0_4px_8px_rgba(235,104,52,0.3)]',
          expanded ? 'bg-ink rotate-45' : 'bg-accent'
        )}
      >
        <Plus className="w-6 h-6 text-white transition-transform" />
      </button>
    </div>
  );
}

export function NavigationSection() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-semibold text-ink tracking-tight">Navigation</h2>
        <p className="text-muted-foreground text-sm">Desktop drawer, mobile bottom nav, and FAB patterns</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Desktop Sidebar */}
        <div className="space-y-3">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Desktop Sidebar (hover for + icons)</h3>
          <DesktopSidebar />
        </div>

        {/* Mobile Nav + FAB */}
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Mobile Bottom Nav</h3>
            <MobileNav />
          </div>

          <div className="space-y-3">
            <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">FAB (click to expand)</h3>
            <div className="bg-concrete/30 rounded-xl">
              <FABDemo />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
