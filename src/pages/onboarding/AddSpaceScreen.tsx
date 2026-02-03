import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingContainer } from "@/components/onboarding/OnboardingContainer";
import { OnboardingHeader, OnboardingLogoutButton } from "@/components/onboarding/OnboardingHeader";
import { ProgressDots } from "@/components/onboarding/ProgressDots";
import { OnboardingBreadcrumbs } from "@/components/onboarding/OnboardingBreadcrumbs";
import { NeomorphicInput } from "@/components/onboarding/NeomorphicInput";
import { NeomorphicButton } from "@/components/onboarding/NeomorphicButton";
import { ExpandableFactChip } from "@/components/chips/ExpandableFactChip";
import { OnboardingSpaceGroupCard } from "@/components/onboarding/OnboardingSpaceGroupCard";
import { ONBOARDING_SPACE_GROUPS, shortSpaceLabel } from "@/components/onboarding/onboardingSpaceGroups";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useOrganization } from "@/hooks/use-organization";
import { getCurrentStep } from "@/utils/onboardingSteps";
import { toast } from "sonner";
import { Plus, Layers } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function AddSpaceScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const { organization } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [spaceName, setSpaceName] = useState("");
  const [spaces, setSpaces] = useState<string[]>([]);
  const [subSpacesByParent, setSubSpacesByParent] = useState<Record<string, string[]>>({});
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [propertyName, setPropertyName] = useState<string | null>(null);
  const [hasExistingSpaces, setHasExistingSpaces] = useState(false);
  const [hasProperties, setHasProperties] = useState(false);
  const [copyModal, setCopyModal] = useState<{
    baseName: string;
    suggestedName: string;
  } | null>(null);
  const [copyModalInput, setCopyModalInput] = useState("");

  useEffect(() => {
    if (!orgLoading && orgId) {
      // Add a small delay to ensure property is committed after creation
      const timer = setTimeout(() => {
        fetchLatestProperty();
        checkExistingSpaces();
      }, 500);
      return () => clearTimeout(timer);
    } else if (!orgLoading && !orgId) {
      toast.error("Organisation not found");
      navigate("/onboarding/create-organisation");
    }
  }, [orgId, orgLoading]);

  const checkExistingSpaces = async () => {
    if (!orgId) return;
    
    try {
      const { data: existingSpaces } = await supabase
        .from('spaces')
        .select('id')
        .eq('org_id', orgId)
        .limit(1);
      
      setHasExistingSpaces(existingSpaces && existingSpaces.length > 0);
    } catch (error) {
      console.error("Error checking existing spaces:", error);
    }
  };

  const fetchLatestProperty = async () => {
    if (!orgId) return;
    
    try {
      // Refresh session to ensure JWT is up to date
      await supabase.auth.refreshSession();
      
      // Get the latest property for this org
      // Retry a few times in case of timing issues
      let retries = 3;
      let properties = null;
      let propertiesError = null;
      
      while (retries > 0) {
        const result = await supabase
          .from('properties')
          .select('id')
          .eq('org_id', orgId)
          .order('created_at', { ascending: false })
          .limit(1);
        
        properties = result.data;
        propertiesError = result.error;
        
        if (properties && properties.length > 0) {
          break; // Found property, exit retry loop
        }
        
        if (propertiesError) {
          console.error("Error fetching properties:", propertiesError);
          break; // Error occurred, exit retry loop
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 300));
        retries--;
      }

      if (propertiesError) {
        console.error("Error fetching properties after retries:", propertiesError);
        setHasProperties(false);
        return;
      }

      if (properties && properties.length > 0) {
        const property = properties[0];
        setPropertyId(property.id);
        setHasProperties(true);
        console.log("Property ID set:", property.id);
        
        // Fetch property name/address for breadcrumb
        const { data: propertyData } = await supabase
          .from('properties')
          .select('address')
          .eq('id', property.id)
          .single();
        
        if (propertyData) {
          setPropertyName(propertyData.address || "Property");
        }
      } else {
        setHasProperties(false);
        console.log("No properties found for org:", orgId);
      }
    } catch (error) {
      console.error("Error fetching property:", error);
      setHasProperties(false);
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
    const removed = spaces[index];
    setSpaces(spaces.filter((_, i) => i !== index));
    if (removed) {
      const key = removed.toLowerCase().trim();
      setSubSpacesByParent((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const handleAddSubSpace = (parentSpace: string, subSpaceName: string) => {
    const key = parentSpace.toLowerCase().trim();
    setSubSpacesByParent((prev) => ({
      ...prev,
      [key]: [...(prev[key] ?? []), subSpaceName],
    }));
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

  const allSpaceNames = useMemo(
    () => [...spaces, ...Object.values(subSpacesByParent).flat()],
    [spaces, subSpacesByParent]
  );

  const getSuggestedCopyName = (baseName: string): string => {
    const base = baseName.trim();
    const baseLower = base.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^${baseLower}(?:\\s+(\\d+))?$`, "i");
    let maxNum = 0;
    for (const name of allSpaceNames) {
      const m = name.trim().match(re);
      if (m) {
        const n = m[1] ? parseInt(m[1], 10) : 1;
        if (n > maxNum) maxNum = n;
      }
    }
    return `${base} ${maxNum + 1}`;
  };

  const openCopyModal = (name: string) => {
    const suggested = getSuggestedCopyName(name);
    setCopyModal({ baseName: name, suggestedName: suggested });
    setCopyModalInput(suggested);
  };

  const closeCopyModal = () => {
    setCopyModal(null);
    setCopyModalInput("");
  };

  const confirmCopySpace = () => {
    if (!copyModal) return;
    const trimmed = copyModalInput.trim();
    if (!trimmed) return;
    if (allSpaceNames.some((s) => s.toLowerCase().trim() === trimmed.toLowerCase())) {
      toast.error("Space already added");
      return;
    }
    if (allSpaceNames.length >= 20) {
      toast.error("Maximum 20 spaces allowed");
      return;
    }
    setSpaces([...spaces, trimmed]);
    closeCopyModal();
  };

  const handleSave = async () => {
    if (!propertyId) {
      toast.error("Property not found");
      return;
    }

    if (spaces.length === 0) {
      toast.error("Please add at least one space");
      return;
    }

    setLoading(true);
    try {
      const allNames = [...spaces, ...Object.values(subSpacesByParent).flat()];
      const spacesToInsert = allNames.map((name) => ({
        name,
        org_id: orgId,
        property_id: propertyId,
      }));

      const { error } = await supabase
        .from('spaces')
        .insert(spacesToInsert);

      if (error) throw error;

      toast.success(`${allNames.length} space${allNames.length > 1 ? "s" : ""} added!`);
      navigate("/onboarding/invite-team");
    } catch (error: any) {
      toast.error(error.message || "Failed to add spaces");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Mark navigation to prevent AppInitializer interference
    (window as any).__lastOnboardingNavigation = Date.now();
    navigate("/onboarding/invite-team");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSpace();
    }
  };

  // Single source of truth: selected spaces. Derived set for fast lookup (card chips disable when selected).
  const selectedSpacesSet = useMemo(
    () => new Set(spaces.map((s) => s.toLowerCase().trim())),
    [spaces]
  );

  return (
    <OnboardingContainer topRight={<OnboardingLogoutButton />}>
      <div className="animate-fade-in">
        <ProgressDots current={getCurrentStep(location.pathname)} />
        
        {(organization || propertyName) && (
          <OnboardingBreadcrumbs
            items={[
              ...(organization ? [{ label: organization.name }] : []),
              ...(propertyName ? [{ label: propertyName, active: true }] : [])
            ]}
          />
        )}
        
        {/* Spaces icon above title, left-aligned */}
        <div className="flex justify-center items-center text-center mt-[33px] mb-[33px]">
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

        <OnboardingHeader
          title="Add spaces"
          subtitle={hasExistingSpaces 
            ? "You already have spaces. Add more or skip to continue."
            : "Define areas within your property"
          }
          showLogout={false}
        />

        {/* Space group cards: hover to reveal ghost chips; click chip to add to main chip row */}
        <div className="mb-6">
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
            {ONBOARDING_SPACE_GROUPS.map((group) => (
              <OnboardingSpaceGroupCard
                key={group.id}
                group={group}
                selectedSpacesSet={selectedSpacesSet}
                onAddSpace={handleAddSuggestion}
                onCopySpace={openCopyModal}
              />
            ))}
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
              className="h-12 w-12 flex-shrink-0 flex items-center justify-center px-4 rounded-xl text-white transition-all disabled:!opacity-100"
              style={{
                backgroundColor: "#8EC9CE"
              }}
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Copy-space modal: new name (e.g. Bedroom 2), editable or accept */}
        <Dialog open={!!copyModal} onOpenChange={(open) => !open && closeCopyModal()}>
          <DialogContent className="max-w-sm gap-3 p-4" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="text-base font-mono uppercase tracking-wide">
                New space name
              </DialogTitle>
            </DialogHeader>
            <input
              type="text"
              value={copyModalInput}
              onChange={(e) => setCopyModalInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmCopySpace();
                }
                if (e.key === "Escape") closeCopyModal();
              }}
              placeholder="e.g. Bedroom 2"
              className="w-full px-3 py-2 text-sm font-mono uppercase tracking-wide rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <NeomorphicButton variant="ghost" onClick={closeCopyModal}>
                Cancel
              </NeomorphicButton>
              <NeomorphicButton
                variant="primary"
                onClick={confirmCopySpace}
                disabled={!copyModalInput.trim()}
                style={{ backgroundColor: "#8EC9CE" }}
              >
                Add
              </NeomorphicButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Your Spaces – expandable fact chips with chevron dropdown (sub-spaces, + Sub-space, X | More) */}
        {spaces.length > 0 && (
          <div className="mb-6">
            <p className="text-xs text-[#6D7480] mb-2 font-mono uppercase tracking-wide">Your Spaces</p>
            <div className="flex flex-wrap gap-2">
              {spaces.map((space, index) => (
                <ExpandableFactChip
                  key={`${space}-${index}`}
                  label={shortSpaceLabel(space)}
                  subSpaces={subSpacesByParent[space.toLowerCase().trim()] ?? []}
                  onRemove={() => handleRemoveSpace(index)}
                  onAddSubSpace={(name) => handleAddSubSpace(space, name)}
                  className="!shadow-none"
                />
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 space-y-3">
          <NeomorphicButton
            variant="primary"
            onClick={handleSave}
            disabled={loading || spaces.length === 0 || !propertyId}
            style={{ backgroundColor: "#8EC9CE" }}
          >
            {loading ? "Saving..." : "Continue"}
          </NeomorphicButton>

          <NeomorphicButton
            variant="ghost"
            onClick={handleSkip}
          >
            {hasExistingSpaces ? "Continue (you already have spaces)" : "Skip for now"}
          </NeomorphicButton>
        </div>
      </div>
    </OnboardingContainer>
  );
}
