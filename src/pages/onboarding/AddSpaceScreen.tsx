import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { NeomorphicInput } from "@/components/onboarding/NeomorphicInput";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { toast } from "sonner";
import { X, Plus, Layers } from "lucide-react";

const DEFAULT_SUGGESTIONS = ["Living Room", "Kitchen", "Bedroom 1", "Bedroom 2", "Bathroom", "Office"];

export default function AddSpaceScreen() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [spaceName, setSpaceName] = useState("");
  const [spaces, setSpaces] = useState<string[]>([]);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    fetchLatestProperty();
  }, []);

  const fetchLatestProperty = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate("/login");
        return;
      }

      // Get user's org_id
      const { data: memberData } = await supabase
        .from('organisation_members')
        .select('org_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!memberData?.org_id) {
        toast.error("Organisation not found");
        navigate("/onboarding/create-organisation");
        return;
      }

      setOrgId(memberData.org_id);

      // Get the latest property for this org
      const { data: properties } = await supabase
        .from('properties')
        .select('id')
        .eq('org_id', memberData.org_id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (properties && properties.length > 0) {
        setPropertyId(properties[0].id);
      } else {
        toast.error("No property found. Please add a property first.");
        navigate("/onboarding/add-property");
      }
    } catch (error) {
      console.error("Error fetching property:", error);
    }
  };

  const handleAddSpace = () => {
    const trimmed = spaceName.trim();
    if (!trimmed) return;
    
    // Check for duplicates (case-insensitive)
    if (spaces.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Space already added");
      return;
    }

    if (spaces.length >= 20) {
      toast.error("Maximum 20 spaces allowed");
      return;
    }

    setSpaces([...spaces, trimmed]);
    setSpaceName("");
  };

  const handleRemoveSpace = (index: number) => {
    setSpaces(spaces.filter((_, i) => i !== index));
  };

  const handleAddSuggestion = (suggestion: string) => {
    if (spaces.some(s => s.toLowerCase() === suggestion.toLowerCase())) {
      return; // Already added
    }
    if (spaces.length >= 20) {
      toast.error("Maximum 20 spaces allowed");
      return;
    }
    setSpaces([...spaces, suggestion]);
  };

  const handleSave = async () => {
    if (!propertyId || !orgId) {
      toast.error("Property not found");
      return;
    }

    if (spaces.length === 0) {
      toast.error("Please add at least one space");
      return;
    }

    setLoading(true);
    try {
      // Insert all spaces
      const spacesToInsert = spaces.map(name => ({
        name,
        org_id: orgId,
        property_id: propertyId
      }));

      const { error } = await supabase
        .from('spaces')
        .insert(spacesToInsert);

      if (error) throw error;

      toast.success(`${spaces.length} space${spaces.length > 1 ? 's' : ''} added!`);
      navigate("/onboarding/invite-team");
    } catch (error: any) {
      toast.error(error.message || "Failed to add spaces");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigate("/onboarding/invite-team");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSpace();
    }
  };

  // Filter out already-added suggestions
  const availableSuggestions = DEFAULT_SUGGESTIONS.filter(
    s => !spaces.some(space => space.toLowerCase() === s.toLowerCase())
  );

  return (
    <OnboardingContainer>
      <div className="animate-fade-in">
        <ProgressDots current={4} total={6} />
        
        <OnboardingHeader
          title="Add spaces"
          subtitle="Define areas within your property"
        />

        <div className="mb-6 flex justify-center">
          <div 
            className="p-4 rounded-2xl"
            style={{
              backgroundColor: "#0EA5E9",
              boxShadow: "3px 3px 8px rgba(0,0,0,0.1), -2px -2px 6px rgba(255,255,255,0.3)"
            }}
          >
            <Layers className="w-10 h-10 text-white" />
          </div>
        </div>

        {/* Input field */}
        <div className="mb-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <NeomorphicInput
                placeholder="Enter space name..."
                value={spaceName}
                onChange={(e) => setSpaceName(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <button
              type="button"
              onClick={handleAddSpace}
              disabled={!spaceName.trim()}
              className="px-4 rounded-xl text-white transition-all disabled:opacity-50"
              style={{
                backgroundColor: "#0EA5E9",
                boxShadow: "3px 3px 8px rgba(0,0,0,0.1), -2px -2px 6px rgba(255,255,255,0.3)"
              }}
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick add suggestions */}
        {availableSuggestions.length > 0 && (
          <div className="mb-6">
            <p className="text-xs text-[#6D7480] mb-2">Quick add:</p>
            <div className="flex flex-wrap gap-2">
              {availableSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleAddSuggestion(suggestion)}
                  className="px-3 py-1.5 text-sm rounded-lg text-[#6D7480] hover:text-[#1C1C1C] transition-colors"
                  style={{
                    boxShadow: "2px 2px 4px rgba(0,0,0,0.06), -2px -2px 4px rgba(255,255,255,0.7)"
                  }}
                >
                  + {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Added spaces list */}
        {spaces.length > 0 && (
          <div className="mb-6">
            <p className="text-xs text-[#6D7480] mb-2">Spaces to add ({spaces.length}):</p>
            <div className="flex flex-wrap gap-2">
              {spaces.map((space, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[#1C1C1C] text-sm"
                  style={{
                    backgroundColor: "rgba(14, 165, 233, 0.1)",
                    boxShadow: "inset 1px 1px 2px rgba(0,0,0,0.05)"
                  }}
                >
                  <span>{space}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSpace(index)}
                    className="ml-1 text-[#6D7480] hover:text-[#FF6B6B] transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 space-y-3">
          <NeomorphicButton
            variant="primary"
            onClick={handleSave}
            disabled={loading || spaces.length === 0}
          >
            {loading ? "Saving..." : `Save ${spaces.length} Space${spaces.length !== 1 ? 's' : ''}`}
          </NeomorphicButton>

          <NeomorphicButton
            variant="ghost"
            onClick={handleSkip}
          >
            Skip for now
          </NeomorphicButton>
        </div>
      </div>
    </OnboardingContainer>
  );
}
