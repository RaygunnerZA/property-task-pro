import { ChevronLeft, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/** Logout button for onboarding – use in OnboardingContainer topRight and set OnboardingHeader showLogout={false} */
export function OnboardingLogoutButton() {
  const navigate = useNavigate();
  const handleLogout = async () => {
    (window as any).__lastOnboardingNavigation = Date.now() + 5000;
    await supabase.auth.signOut();
    navigate("/welcome", { replace: true });
  }
  return (
    <button
      type="button"
      onClick={handleLogout}
      className="p-2 rounded-lg text-muted-foreground shadow-inset hover:text-destructive transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      aria-label="Log out"
      title="Log out"
    >
      <LogOut className="w-5 h-5" />
    </button>
  );
}

interface OnboardingHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  showLogout?: boolean;
}

export function OnboardingHeader({ title, subtitle, showBack, onBack, showLogout = true }: OnboardingHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    (window as any).__lastOnboardingNavigation = Date.now();
    if (onBack) onBack();
    else navigate(-1);
  };

  const handleLogout = async () => {
    (window as any).__lastOnboardingNavigation = Date.now() + 5000;
    await supabase.auth.signOut();
    navigate("/welcome", { replace: true });
  };

  return (
    <div className="mb-8">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          {showBack && (
            <button
              onClick={handleBack}
              className="p-2 rounded-lg text-muted-foreground shadow-inset hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label="Go back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
        </div>
        
        {showLogout && (
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-muted-foreground shadow-inset hover:text-destructive transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        )}
      </div>
      
      <h1 className="text-3xl font-semibold text-foreground mb-2 [text-wrap:balance] heading-xl text-center [background-clip:unset] [-webkit-background-clip:unset]">{title}</h1>
      {subtitle && (
        <p className="text-base text-muted-foreground text-center">{subtitle}</p>
      )}
    </div>
  );
}
