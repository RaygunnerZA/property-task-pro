import { LayoutDashboard, Building2, CheckSquare, Package } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export const BottomNav = () => {
  const location = useLocation();
  
  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/properties', icon: Building2, label: 'Properties' },
    { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
    { to: '/assets', icon: Package, label: 'Assets' },
  ];

  const isActiveRoute = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card border-border shadow-e1">
      <div className="max-w-md mx-auto px-2 py-1.5">
        <div className="flex items-center justify-around">
          {navItems.map(({ to, icon: Icon, label }) => {
            const isActive = isActiveRoute(to);
            
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95",
                  isActive && "scale-105"
                )}
              >
                <Icon 
                  className={cn(
                    "h-5 w-5 transition-colors",
                    isActive ? "text-[#8EC9CE]" : "text-muted-foreground"
                  )} 
                />
                <span 
                  className={cn(
                    "text-[10px] font-semibold tracking-tight transition-colors",
                    isActive ? "text-[#8EC9CE]" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
