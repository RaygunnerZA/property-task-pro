import { ReactNode } from 'react';
import { ArrowLeft, Search, User as UserIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ContextHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  action?: ReactNode;
  showSearch?: boolean;
  showAvatar?: boolean;
}

export const ContextHeader = ({ 
  title, 
  subtitle, 
  backTo, 
  action,
  showSearch = true,
  showAvatar = true
}: ContextHeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b backdrop-blur-sm bg-card/95 border-border shadow-e1">
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {backTo && (
              <button
                onClick={() => navigate(backTo)}
                className="p-2 -ml-2 rounded-lg bg-card shadow-e1 transition-all duration-200 hover:scale-105 active:scale-95"
              >
                <ArrowLeft className="h-5 w-5 text-foreground" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight truncate text-foreground">
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm truncate mt-0.5 text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {action}
            
            {showSearch && (
              <button
                className="p-2 rounded-lg bg-card shadow-e1 transition-all duration-200 hover:scale-105 active:scale-95"
                aria-label="Search"
              >
                <Search className="h-5 w-5 text-muted-foreground" />
              </button>
            )}
            
            {showAvatar && (
              <button
                onClick={() => navigate('/account')}
                className="p-2 rounded-lg bg-card shadow-e1 transition-all duration-200 hover:scale-105 active:scale-95"
                aria-label="Account"
              >
                <UserIcon className="h-5 w-5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
