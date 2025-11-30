import { ReactNode } from 'react';
import { ArrowLeft, Search, User as UserIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { colors, shadows } from '@/components/filla/DesignSystem';

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
    <header 
      className="sticky top-0 z-40 border-b backdrop-blur-sm"
      style={{ 
        backgroundColor: `${colors.surface}f5`,
        borderColor: colors.concrete,
        boxShadow: shadows.outset
      }}
    >
      <div className="max-w-md mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          {/* Left side - Back button + Title */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {backTo && (
              <button
                onClick={() => navigate(backTo)}
                className="p-2 -ml-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
                style={{ 
                  backgroundColor: colors.surface,
                  boxShadow: shadows.outset 
                }}
              >
                <ArrowLeft className="h-5 w-5" style={{ color: colors.ink }} />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <h1 
                className="text-2xl font-bold tracking-tight truncate"
                style={{ color: colors.ink }}
              >
                {title}
              </h1>
              {subtitle && (
                <p 
                  className="text-sm truncate mt-0.5"
                  style={{ color: colors.textMuted }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          
          {/* Right side - Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {action}
            
            {showSearch && (
              <button
                className="p-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
                style={{ 
                  backgroundColor: colors.surface,
                  boxShadow: shadows.outset 
                }}
                aria-label="Search"
              >
                <Search className="h-5 w-5" style={{ color: colors.textMuted }} />
              </button>
            )}
            
            {showAvatar && (
              <button
                onClick={() => navigate('/account')}
                className="p-2 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
                style={{ 
                  backgroundColor: colors.surface,
                  boxShadow: shadows.outset 
                }}
                aria-label="Account"
              >
                <UserIcon className="h-5 w-5" style={{ color: colors.textMuted }} />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
