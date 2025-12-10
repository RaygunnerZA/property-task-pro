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

  // Fan positions: angle from center, distance from center
  const fabButtons = [
    { icon: Mic, angle: -135, label: 'Voice' },      // top-left
    { icon: Camera, angle: -45, label: 'Camera' },   // top-right  
    { icon: CheckSquare, angle: -90, label: 'Task' }, // left
  ];

  const getPosition = (angle: number, distance: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: Math.cos(rad) * distance,
      y: Math.sin(rad) * distance,
    };
  };

  return (
    <div className="relative h-56 flex items-center justify-center">
      {/* Expanded buttons - animate from center */}
      {fabButtons.map((btn, i) => {
        const Icon = btn.icon;
        const pos = expanded ? getPosition(btn.angle, 70) : { x: 0, y: 0 };
        
        return (
          <button
            key={btn.label}
            className={cn(
              'absolute w-14 h-14 rounded-full bg-surface shadow-e2 flex items-center justify-center text-ink transition-all duration-300 ease-out hover:scale-110',
              expanded ? 'opacity-100 scale-100' : 'opacity-0 scale-50 pointer-events-none'
            )}
            style={{
              transform: `translate(${pos.x}px, ${pos.y}px)`,
              transitionDelay: expanded ? `${i * 50}ms` : '0ms',
            }}
          >
            <Icon className="w-5 h-5" />
          </button>
        );
      })}

      {/* Main FAB */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'relative z-10 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300',
          'shadow-fab',
          expanded ? 'bg-ink' : 'bg-ink'
        )}
      >
        <Plus className={cn(
          'w-7 h-7 text-white transition-transform duration-300',
          expanded && 'rotate-45'
        )} />
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
