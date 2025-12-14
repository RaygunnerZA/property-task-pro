import { Home, Briefcase, Building2, User } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';

export const BottomNav = () => {
  const location = useLocation();
  
  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/work', icon: Briefcase, label: 'Work' },
    { to: '/spaces', icon: Building2, label: 'Spaces' },
    { to: '/account', icon: User, label: 'Account' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card border-border shadow-e1">
      <div className="max-w-md mx-auto px-2 py-1.5">
        <div className="flex items-center justify-around">
          {navItems.map(({ to, icon: Icon, label }) => {
            const isActive = location.pathname === to;
            
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 ${isActive ? 'scale-105' : ''}`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-[10px] font-semibold tracking-tight ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
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
