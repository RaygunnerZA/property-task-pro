import { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ContextHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
  action?: ReactNode;
}

export const ContextHeader = ({ title, subtitle, backTo, action }: ContextHeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border z-40 shadow-e1">
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {backTo && (
              <button
                onClick={() => navigate(backTo)}
                className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-foreground truncate">{title}</h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
              )}
            </div>
          </div>
          {action && <div className="shrink-0 ml-2">{action}</div>}
        </div>
      </div>
    </header>
  );
};
