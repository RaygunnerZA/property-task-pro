import { ChevronLeft, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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
    // Mark navigation to prevent AppInitializer interference
    (window as any).__lastOnboardingNavigation = Date.now();
    
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  const handleLogout = async () => {
    // Mark that we're leaving onboarding
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
              className="p-2 rounded-lg text-[#6D7480] hover:text-[#1C1C1C] transition-colors duration-150"
              style={{
                boxShadow: "inset 1px 1px 3px rgba(0,0,0,0.1), inset -1px -1px 3px rgba(255,255,255,0.7)"
              }}
              aria-label="Go back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
        </div>
        
        {showLogout && (
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-[#6D7480] hover:text-[#FF6B6B] transition-colors duration-150"
            style={{
              boxShadow: "inset 1px 1px 3px rgba(0,0,0,0.1), inset -1px -1px 3px rgba(255,255,255,0.7)"
            }}
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        )}
      </div>
      
      <h1 className="text-3xl font-semibold text-[#1C1C1C] mb-2">{title}</h1>
      {subtitle && (
        <p className="text-base text-[#6D7480]">{subtitle}</p>
      )}
    </div>
  );
}
