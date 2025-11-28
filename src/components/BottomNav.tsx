import { Home, Calendar, Building2, Plus } from 'lucide-react';
import { NavLink } from '@/components/NavLink';

export const BottomNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="max-w-md mx-auto px-2 py-2">
        <div className="flex items-center justify-around">
          <NavLink 
            to="/"
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-muted-foreground transition-colors"
            activeClassName="text-primary bg-secondary"
          >
            <Home className="h-5 w-5" />
            <span className="text-xs font-medium">Tasks</span>
          </NavLink>

          <NavLink 
            to="/schedule"
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-muted-foreground transition-colors"
            activeClassName="text-primary bg-secondary"
          >
            <Calendar className="h-5 w-5" />
            <span className="text-xs font-medium">Schedule</span>
          </NavLink>

          <NavLink 
            to="/add-task"
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-muted-foreground transition-colors"
            activeClassName="text-primary bg-secondary"
          >
            <Plus className="h-5 w-5" />
            <span className="text-xs font-medium">Add</span>
          </NavLink>

          <NavLink 
            to="/properties"
            className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg text-muted-foreground transition-colors"
            activeClassName="text-primary bg-secondary"
          >
            <Building2 className="h-5 w-5" />
            <span className="text-xs font-medium">Properties</span>
          </NavLink>
        </div>
      </div>
    </nav>
  );
};
