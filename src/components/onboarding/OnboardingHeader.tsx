import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface OnboardingHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export function OnboardingHeader({ title, subtitle, showBack, onBack }: OnboardingHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="mb-8">
      {showBack && (
        <button
          onClick={handleBack}
          className="mb-4 p-2 rounded-lg text-[#6D7480] hover:text-[#1C1C1C] transition-colors duration-150"
          style={{
            boxShadow: "inset 1px 1px 3px rgba(0,0,0,0.1), inset -1px -1px 3px rgba(255,255,255,0.7)"
          }}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      
      <h1 className="text-3xl font-semibold text-[#1C1C1C] mb-2">{title}</h1>
      {subtitle && (
        <p className="text-base text-[#6D7480]">{subtitle}</p>
      )}
    </div>
  );
}
