import { useNavigate } from "react-router-dom";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { useOnboardingStore } from "@/hooks/useOnboardingStore";

export default function PreferencesScreen() {
  const navigate = useNavigate();
  const { 
    aiEnabled, 
    taskSuggestions, 
    units,
    setAiEnabled, 
    setTaskSuggestions, 
    setUnits 
  } = useOnboardingStore();

  const handleContinue = () => {
    // Save preferences to localStorage
    localStorage.setItem('filla_preferences', JSON.stringify({
      aiEnabled,
      taskSuggestions,
      units
    }));
    
    navigate("/onboarding/complete");
  };

  const ToggleSwitch = ({ enabled, onChange }: { enabled: boolean; onChange: (val: boolean) => void }) => (
    <button
      onClick={() => onChange(!enabled)}
      className={`
        relative w-12 h-7 rounded-full transition-all duration-150
        ${enabled ? 'bg-[#FF6B6B]' : 'bg-[#6D7480]/30'}
      `}
      style={{
        boxShadow: enabled 
          ? "inset 2px 2px 4px rgba(0,0,0,0.15), inset -1px -1px 3px rgba(255,255,255,0.3)"
          : "inset 2px 2px 4px rgba(0,0,0,0.08), inset -2px -2px 4px rgba(255,255,255,0.7)"
      }}
    >
      <div
        className={`
          absolute top-1 w-5 h-5 bg-white rounded-full
          transition-all duration-150
          ${enabled ? 'left-6' : 'left-1'}
        `}
        style={{
          boxShadow: "1px 1px 3px rgba(0,0,0,0.2)"
        }}
      />
    </button>
  );

  return (
    <OnboardingContainer>
      <div className="animate-fade-in">
        <ProgressDots current={5} total={6} />
        
        <OnboardingHeader
          title="Set your preferences"
          subtitle="Customize your Filla experience"
        />

        <div className="space-y-6">
          <div 
            className="p-4 rounded-xl"
            style={{
              boxShadow: "inset 1px 1px 3px rgba(0,0,0,0.08), inset -1px -1px 3px rgba(255,255,255,0.7)"
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className="text-base font-medium text-[#1C1C1C]">AI Assistance</h3>
                <p className="text-sm text-[#6D7480]">Get smart suggestions</p>
              </div>
              <ToggleSwitch enabled={aiEnabled} onChange={setAiEnabled} />
            </div>
          </div>

          <div 
            className="p-4 rounded-xl"
            style={{
              boxShadow: "inset 1px 1px 3px rgba(0,0,0,0.08), inset -1px -1px 3px rgba(255,255,255,0.7)"
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className="text-base font-medium text-[#1C1C1C]">Task Suggestions</h3>
                <p className="text-sm text-[#6D7480]">Auto-create tasks from events</p>
              </div>
              <ToggleSwitch enabled={taskSuggestions} onChange={setTaskSuggestions} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#6D7480] mb-3">
              Unit System
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['metric', 'imperial'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnits(u)}
                  className={`
                    px-4 py-3 rounded-xl text-sm font-medium capitalize
                    transition-all duration-150 ease-out
                    ${units === u 
                      ? 'text-[#FF6B6B]' 
                      : 'text-[#6D7480] hover:text-[#1C1C1C]'
                    }
                  `}
                  style={{
                    boxShadow: units === u
                      ? "inset 2px 2px 4px rgba(255,107,107,0.15), inset -2px -2px 4px rgba(255,255,255,0.7)"
                      : "inset 1px 1px 3px rgba(0,0,0,0.08), inset -1px -1px 3px rgba(255,255,255,0.7)"
                  }}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4">
            <NeomorphicButton
              variant="primary"
              onClick={handleContinue}
            >
              Continue
            </NeomorphicButton>
          </div>
        </div>
      </div>
    </OnboardingContainer>
  );
}
