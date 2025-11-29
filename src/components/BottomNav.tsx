import { Home, Briefcase, Building2, User } from 'lucide-react';
import { NavLink } from '@/components/NavLink';

export const BottomNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border z-50 shadow-e2">
      <div className="max-w-md mx-auto px-2 py-2">
        <div className="flex items-center justify-around">
          <NavLink 
            to="/"
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-muted-foreground transition-colors"
            activeClassName="text-primary bg-secondary"
          >
            <Home className="h-5 w-5" />
            <span className="text-xs font-medium">Home</span>
          </NavLink>

          <NavLink 
            to="/work"
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-muted-foreground transition-colors"
            activeClassName="text-primary bg-secondary"
          >
            <Briefcase className="h-5 w-5" />
            <span className="text-xs font-medium">Work</span>
          </NavLink>

          <NavLink 
            to="/spaces"
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-muted-foreground transition-colors"
            activeClassName="text-primary bg-secondary"
          >
            <Building2 className="h-5 w-5" />
            <span className="text-xs font-medium">Spaces</span>
          </NavLink>

          <NavLink 
            to="/account"
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-muted-foreground transition-colors"
            activeClassName="text-primary bg-secondary"
          >
            <User className="h-5 w-5" />
            <span className="text-xs font-medium">Account</span>
          </NavLink>
        </div>
      </div>
    </nav>
  );
};
