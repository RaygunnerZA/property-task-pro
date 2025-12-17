import React, { useState } from 'react';
import { 
  LayoutDashboard, CheckSquare, Calendar, Building2, 
  FolderOpen, ShieldCheck, Zap, LineChart, Bell, Settings, 
  LogOut, Plus, Camera, Menu, Home, Inbox, Mic
} from 'lucide-react';
import { cn } from '@/lib/utils';
import fillaLogo from '@/assets/filla-logo-teal.svg';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', hasAdd: false },
  { icon: CheckSquare, label: 'Tasks', hasAdd: true },
  { icon: Calendar, label: 'Schedule', hasAdd: true },
  { icon: Building2, label: 'Properties', hasAdd: true },
  { icon: FolderOpen, label: 'Assets', hasAdd: true },
  { icon: ShieldCheck, label: 'Compliance', hasAdd: true },
  { section: 'INTELLIGENCE' },
  { icon: Zap, label: 'Automations', hasAdd: false },
  { icon: LineChart, label: 'Insights', hasAdd: false },
  { section: 'OTHER' },
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

// DesktopSidebar removed - use AppSidebar component directly

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
    <div className="relative h-48 flex items-end justify-center pb-4">
      {/* Expanded buttons - Fanned out with card-flat style */}
      {expanded && (
        <div className="absolute bottom-20 flex flex-col items-center animate-fade-in">
          {/* Mic button - top, offset left */}
          <button 
            className="absolute -top-24 -left-8 w-12 h-12 rounded-full bg-card-flat shadow-e1 flex items-center justify-center text-primary hover:translate-y-[-2px] transition-transform"
            style={{ 
              backgroundColor: 'rgba(241, 238, 232, 0.8)',
              boxShadow: '1px 3px 4px 0px rgba(0, 0, 0, 0.1), inset 1px 1px 1px rgba(255, 255, 255, 0.4)'
            }}
          >
            <Mic className="w-5 h-5" />
          </button>
          {/* Camera button - middle, offset right */}
          <button 
            className="absolute -top-16 left-8 w-12 h-12 rounded-full bg-card-flat shadow-e1 flex items-center justify-center text-primary hover:translate-y-[-2px] transition-transform"
            style={{ 
              backgroundColor: 'rgba(241, 238, 232, 0.8)',
              boxShadow: '1px 3px 4px 0px rgba(0, 0, 0, 0.1), inset 1px 1px 1px rgba(255, 255, 255, 0.4)'
            }}
          >
            <Camera className="w-5 h-5" />
          </button>
          {/* Task button - bottom center */}
          <button 
            className="absolute -top-8 w-12 h-12 rounded-full bg-card-flat shadow-e1 flex items-center justify-center text-primary hover:translate-y-[-2px] transition-transform"
            style={{ 
              backgroundColor: 'rgba(241, 238, 232, 0.8)',
              boxShadow: '1px 3px 4px 0px rgba(0, 0, 0, 0.1), inset 1px 1px 1px rgba(255, 255, 255, 0.4)'
            }}
          >
            <CheckSquare className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Main FAB */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'w-14 h-14 rounded-full flex items-center justify-center transition-all',
          'shadow-fab',
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
        <h2 className="font-display text-2xl font-semibold text-ink tracking-tight heading-l">Navigation</h2>
        <p className="text-muted-foreground text-sm">Mobile bottom nav and FAB patterns (desktop sidebar is live on left)</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Mobile Nav */}
        <div className="space-y-3">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Mobile Bottom Nav</h3>
          <MobileNav />
        </div>

        {/* FAB */}
        <div className="space-y-3">
          <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">FAB (click to expand - fanned out)</h3>
          <div className="bg-concrete/30 rounded-[5px]">
            <FABDemo />
          </div>
        </div>
      </div>
    </section>
  );
}
