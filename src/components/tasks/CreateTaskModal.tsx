import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { X, Plus, ChevronDown, ChevronUp, User, Calendar, MapPin, AlertTriangle, ListTodo, Shield, Check, Tag, Box } from "lucide-react";
import { useAIExtract } from "@/hooks/useAIExtract";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useChecklistTemplates } from "@/hooks/useChecklistTemplates";
import { useLastUsedProperty } from "@/hooks/useLastUsedProperty";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useSpaces } from "@/hooks/useSpaces";
import { useTeams } from "@/hooks/useTeams";
import { useCategories } from "@/hooks/useCategories";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

// Tab Components (keeping for backward compatibility during transition)
import { WhoTab, type PendingInvitation } from "./create/tabs/WhoTab";
import { WhenTab } from "./create/tabs/WhenTab";
import { WhereTab } from "./create/tabs/WhereTab";
import { PriorityTab } from "./create/tabs/PriorityTab";

// New Panel Components
import { WherePanel } from "./create/panels/WherePanel";
import { AssetPanel } from "./create/panels/AssetPanel";
import { WhoPanel } from "./create/panels/WhoPanel";
import { WhenPanel } from "./create/panels/WhenPanel";
import { CategoryPanel } from "./create/panels/CategoryPanel";
import { ClarityState, ClaritySeverity } from "./create/ClarityState";
import { FillaIcon } from "@/components/filla/FillaIcon";
import { useChipSuggestions } from "@/hooks/useChipSuggestions";
import { resolveChip, type AvailableEntities } from "@/services/ai/resolutionPipeline";
import type { EntityType } from "@/types/chip-suggestions";
import { queryResolutionMemory, storeResolutionMemory } from "@/services/ai/resolutionMemory";
import { logChipResolution } from "@/services/ai/resolutionAudit";
import type { SuggestedChip, ChipType } from "@/types/chip-suggestions";
import { Chip } from "@/components/chips/Chip";

// Section Components
import { SubtasksSection, type SubtaskInput } from "./create/SubtasksSection";
import { ImageUploadSection } from "./create/ImageUploadSection";
import { ThemesSection } from "./create/ThemesSection";
import { AssetsSection } from "./create/AssetsSection";
import { TaskSection } from "./create/TaskSection";
import { WhoSectionRow } from "./create/WhoSectionRow";
import type { CreateTaskPayload, TaskPriority, RepeatRule } from "@/types/database";
import type { TempImage } from "@/types/temp-image";
import { cleanupTempImage } from "@/utils/image-optimization";
interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated?: (taskId: string) => void;
  defaultPropertyId?: string;
  defaultDueDate?: string;
  variant?: "modal" | "column"; // "modal" for dialog/drawer, "column" for third column panel
}
export function CreateTaskModal({
  open,
  onOpenChange,
  onTaskCreated,
  defaultPropertyId,
  defaultDueDate,
  variant = "modal"
}: CreateTaskModalProps) {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const {
    orgId,
    isLoading: orgLoading
  } = useActiveOrg();
  const {
    templates
  } = useChecklistTemplates();
  const { lastUsedPropertyId, setLastUsed } = useLastUsedProperty();
  const { members } = useOrgMembers();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // NO DEFAULT PROPERTY - start with empty
  const [propertyId, setPropertyId] = useState("");
  
  // Hooks that depend on form state
  const { spaces } = useSpaces(propertyId || undefined);
  // NO DEFAULT PROPERTY - start with empty array
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);

  // DO NOT initialize propertyId from last used - user must explicitly select
  
  // Reset form state when modal opens (ensures no default property)
  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setPropertyId("");
      setSelectedPropertyIds([]);
      setSelectedSpaceIds([]);
      setPriority("medium");
      setDueDate(defaultDueDate || "");
      setRepeatRule(undefined);
      setAssignedUserId(undefined);
      setAssignedTeamIds([]);
      setSelectedThemeIds([]);
      setSelectedAssetIds([]);
      setImages([]);
      setSubtasks([]);
      setTemplateId("");
      setIsCompliance(false);
      setComplianceLevel("");
      setAnnotationRequired(false);
      setExpandedSection(null);
      setShowTitleField(false);
      setAiTitleGenerated("");
      setUserEditedTitle(false);
      setAppliedChips(new Map());
      setSelectedChipIds([]);
    }
  }, [open, defaultDueDate]);

  // Update last used when property changes
  const handlePropertyChange = (newPropertyIds: string[]) => {
    setSelectedPropertyIds(newPropertyIds);
    // Mark as explicitly selected
    setExplicitPropertyIds(prev => {
      const updated = new Set(prev);
      newPropertyIds.forEach(id => updated.add(id));
      return updated;
    });
    // Use first property as primary for backward compatibility
    const primaryPropertyId = newPropertyIds.length > 0 ? newPropertyIds[0] : "";
    setPropertyId(primaryPropertyId);
    if (primaryPropertyId) {
      setLastUsed(primaryPropertyId);
    }
    // Clear spaces when properties change
    if (newPropertyIds.length === 0) {
      setSelectedSpaceIds([]);
    }
  };
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState(defaultDueDate || "");
  const [repeatRule, setRepeatRule] = useState<RepeatRule | undefined>();
  const [assignedUserId, setAssignedUserId] = useState<string | undefined>();
  const [assignedTeamIds, setAssignedTeamIds] = useState<string[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [isCompliance, setIsCompliance] = useState(false);
  const [complianceLevel, setComplianceLevel] = useState("");
  const [annotationRequired, setAnnotationRequired] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [subtasks, setSubtasks] = useState<SubtaskInput[]>([]);
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [images, setImages] = useState<TempImage[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // System-level section model: Only one section expanded at a time
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // AI Title extraction
  const [aiTitleGenerated, setAiTitleGenerated] = useState("");
  const [userEditedTitle, setUserEditedTitle] = useState(false);
  const [showTitleField, setShowTitleField] = useState(false);
  
  // Call AI extraction hook (using the working hook)
  const { result: aiResult, loading: aiLoading, error: aiError } = useAIExtract(description);
  
  // Chip suggestions with resolution pipeline
  const { chips: chipSuggestions, ghostCategories, loading: chipsLoading, error: chipsError } = useChipSuggestions({
    description,
    propertyId,
    selectedSpaceIds,
    selectedPersonId: assignedUserId,
    selectedTeamIds: assignedTeamIds,
    originalText: description, // Pass original text with capitalization for person/property detection
  });
  
  // Track applied chips and their resolution state
  const [appliedChips, setAppliedChips] = useState<Map<string, SuggestedChip>>(new Map());
  const [selectedChipIds, setSelectedChipIds] = useState<string[]>([]);
  
  // Fact chips include: person, team, space, asset, category, date, recurrence, property
  // Recurrence never blocks entity resolution - only space, asset, person do
  const factChipTypes: ChipType[] = ['person', 'team', 'space', 'asset', 'category', 'date', 'recurrence', 'property'];
  
  // Calculate fact chips (resolved context) - chips that are resolved or don't require blocking
  const factChips = useMemo(() => {
    const chipMap = new Map<string, SuggestedChip>();
    
    // Add suggestions first
    chipSuggestions
      .filter(chip => factChipTypes.includes(chip.type))
      .forEach(chip => chipMap.set(chip.id, chip));
    
    // Override with applied chips (more current state)
    Array.from(appliedChips.values())
      .filter(chip => factChipTypes.includes(chip.type))
      .forEach(chip => chipMap.set(chip.id, chip));
    
    // Fact chips are resolved (have resolvedEntityId) OR don't require blocking
    return Array.from(chipMap.values()).filter(chip => 
      chip.resolvedEntityId || !chip.blockingRequired
    );
  }, [chipSuggestions, appliedChips]);
  
  // Calculate verb (unresolved) chips - chips that require blocking and aren't resolved
  const verbChips = useMemo(() => {
    const chipMap = new Map<string, SuggestedChip>();
    
    // Add suggestions first
    chipSuggestions
      .filter(chip => factChipTypes.includes(chip.type))
      .forEach(chip => chipMap.set(chip.id, chip));
    
    // Override with applied chips (more current state)
    Array.from(appliedChips.values())
      .filter(chip => factChipTypes.includes(chip.type))
      .forEach(chip => chipMap.set(chip.id, chip));
    
    // A chip is unresolved (verb) if: blockingRequired && !resolvedEntityId
    // Recurrence chips never have blockingRequired, so they're excluded from verb chips
    // Invite candidate chips (isInviteCandidate) are fact chips, not verb chips
    return Array.from(chipMap.values()).filter(chip => 
      chip.blockingRequired && !chip.resolvedEntityId && !chip.metadata?.isInviteCandidate
    );
  }, [chipSuggestions, appliedChips]);
  
  // Helper to generate verb label
  const generateVerbLabel = useCallback((chip: SuggestedChip): string => {
    const value = chip.value || chip.label;
    switch (chip.type) {
      case 'person':
        return `INVITE ${value.toUpperCase()}`;
      case 'team':
        return `CHOOSE ${value.toUpperCase()}`;
      case 'space':
        return `ADD ${value.toUpperCase()} TO SPACES`;
      case 'asset':
        return `ADD ${value.toUpperCase()} TO ASSETS`;
      case 'category':
        return `CHOOSE ${value.toUpperCase()}`;
      case 'date':
        return `SET ${value.toUpperCase()}`;
      default:
        return `CHOOSE ${value.toUpperCase()}`;
    }
  }, []);

  // Calculate unresolved sections from verb chips
  const unresolvedSections = useMemo(() => {
    const unresolved: string[] = [];
    const chipTypeToSection: Record<string, string> = {
      'person': 'who',
      'team': 'who',
      'space': 'where',
      'asset': 'what',
      'category': 'tags',
      'theme': 'tags',
      'date': 'when',
    };
    
    verbChips.forEach(chip => {
      const section = chipTypeToSection[chip.type];
      if (section && !unresolved.includes(section)) {
        unresolved.push(section);
      }
    });
    
    return unresolved;
  }, [verbChips]);

  // Group verb chips by section for display
  // Note: We'll create handlers after handleChipSelect is defined
  const verbChipsBySectionBase = useMemo(() => {
    const chipTypeToSection: Record<string, string> = {
      'person': 'who',
      'team': 'who',
      'property': 'where',
      'space': 'where',
      'asset': 'what',
      'category': 'tags',
      'theme': 'tags',
      'date': 'when',
    };
    
    const grouped: Record<string, Array<{ id: string; label: string; chip: SuggestedChip }>> = {
      'who': [],
      'where': [],
      'when': [],
      'what': [],
      'tags': [],
      'compliance': [],
    };
    
    verbChips.forEach(chip => {
      const section = chipTypeToSection[chip.type];
      if (section) {
        grouped[section].push({
          id: chip.id,
          label: generateVerbLabel(chip),
          chip: chip
        });
      }
    });
    
    return grouped;
  }, [verbChips, generateVerbLabel]);
  
  // Clarity state
  const [clarityState, setClarityState] = useState<{
    severity: ClaritySeverity;
    message: string;
  } | null>(null);
  
  // Instruction block state - track which entity needs to be added
  const [instructionBlock, setInstructionBlock] = useState<{
    section: string;
    entityName: string;
    entityType: string;
  } | null>(null);
  
  // Get teams and categories for resolution
  const { teams } = useTeams();
  const { categories } = useCategories();
  const { data: properties = [] } = usePropertiesQuery();
  
  // Load assets for What section
  const [assets, setAssets] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    // Hard guard: do not query if propertyId is missing
    if (!propertyId) {
      setAssets([]);
      return;
    }

    if (!orgId) {
      setAssets([]);
      return;
    }

    console.log("[ASSETS QUERY]", { orgId, propertyId });

    supabase
      .from('assets')
      .select('id, serial')
      .eq('org_id', orgId)
      .eq('property_id', propertyId)
      .then(({ data, error }) => {
        if (error) {
          console.error('[ASSETS QUERY] Error:', error);
          setAssets([]);
          return;
        }
        // Map serial to name for compatibility
        if (data) {
          setAssets(data.map(asset => ({ id: asset.id, name: asset.serial || 'Unnamed Asset' })));
        } else {
          setAssets([]);
        }
      });
  }, [propertyId, orgId]);
  
  // Load themes for Tags section
  const [themes, setThemes] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    if (orgId) {
      supabase
        .from('themes')
        .select('id, name')
        .eq('org_id', orgId)
        .then(({ data }) => {
          if (data) setThemes(data);
        });
    }
  }, [orgId]);
  
  // Track whether properties are explicitly selected vs inferred
  const [explicitPropertyIds, setExplicitPropertyIds] = useState<Set<string>>(new Set());
  
  // Mark property as explicitly selected when user changes it
  useEffect(() => {
    if (selectedPropertyIds.length > 0) {
      setExplicitPropertyIds(prev => {
        const updated = new Set(prev);
        selectedPropertyIds.forEach(id => updated.add(id));
        return updated;
      });
    }
  }, [selectedPropertyIds]);

  // HIGH-CONFIDENCE FACTS: Automatically apply resolved chips from suggestions to form state
  // This ensures facts appear immediately in section headers without user interaction
  useEffect(() => {
    // Only process chips that are resolved and haven't been applied yet
    const resolvedChips = chipSuggestions.filter(
      chip => chip.resolvedEntityId && 
      factChipTypes.includes(chip.type) &&
      !appliedChips.has(chip.id)
    );

    resolvedChips.forEach(chip => {
      if (!chip.resolvedEntityId) return;

      switch (chip.type) {
        case 'person':
          if (chip.resolvedEntityType === 'person' && !assignedUserId && chip.resolvedEntityId) {
            setAssignedUserId(chip.resolvedEntityId);
            // Add to applied chips
            const updated = new Map(appliedChips);
            updated.set(chip.id, chip);
            setAppliedChips(updated);
          }
          break;
        case 'team':
          if (chip.resolvedEntityType === 'team' && chip.resolvedEntityId && !assignedTeamIds.includes(chip.resolvedEntityId)) {
            setAssignedTeamIds(prev => [...prev, chip.resolvedEntityId!]);
            // Add to applied chips
            const updated = new Map(appliedChips);
            updated.set(chip.id, chip);
            setAppliedChips(updated);
          }
          break;
        case 'space':
          if (chip.resolvedEntityType === 'space' && chip.resolvedEntityId && !selectedSpaceIds.includes(chip.resolvedEntityId)) {
            setSelectedSpaceIds(prev => [...prev, chip.resolvedEntityId!]);
            // Add to applied chips
            const updated = new Map(appliedChips);
            updated.set(chip.id, chip);
            setAppliedChips(updated);
          }
          break;
        case 'asset':
          if (chip.resolvedEntityType === 'asset' && chip.resolvedEntityId && !selectedAssetIds.includes(chip.resolvedEntityId)) {
            setSelectedAssetIds(prev => [...prev, chip.resolvedEntityId!]);
            // Add to applied chips
            const updated = new Map(appliedChips);
            updated.set(chip.id, chip);
            setAppliedChips(updated);
          }
          break;
        case 'date':
          if (chip.value && !dueDate) {
            try {
              const date = new Date(chip.value);
              if (!isNaN(date.getTime())) {
                // Format as ISO string for dueDate state
                const isoDate = date.toISOString().split('T')[0] + 'T00:00:00';
                setDueDate(isoDate);
                // Add to applied chips
                const updated = new Map(appliedChips);
                updated.set(chip.id, chip);
                setAppliedChips(updated);
              }
            } catch (e) {
              // Invalid date, skip
            }
          }
          break;
        case 'property':
          if (chip.resolvedEntityType === 'property' && chip.resolvedEntityId && !selectedPropertyIds.includes(chip.resolvedEntityId)) {
            handlePropertyChange([...selectedPropertyIds, chip.resolvedEntityId]);
            // Add to applied chips
            const updated = new Map(appliedChips);
            updated.set(chip.id, chip);
            setAppliedChips(updated);
          }
          break;
      }
    });
  }, [chipSuggestions, appliedChips, assignedUserId, assignedTeamIds, selectedSpaceIds, selectedAssetIds, dueDate, selectedPropertyIds, handlePropertyChange]);

  // Extract fact chips for each section (collapsed state shows facts only)
  // HIGH-CONFIDENCE FACTS: Include resolved chips from chipSuggestions and appliedChips
  const whoFactChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove?: () => void; isSuggested?: boolean; tooltip?: string }> = [];
    
    // Add resolved person/team chips from suggestions (high-confidence extracted facts)
    const resolvedPersonChips = [
      ...chipSuggestions.filter(c => c.type === 'person' && c.resolvedEntityId),
      ...Array.from(appliedChips.values()).filter(c => c.type === 'person' && c.resolvedEntityId)
    ];
    resolvedPersonChips.forEach(chip => {
      if (chip.resolvedEntityId && chip.resolvedEntityType === 'person') {
        const member = members.find(m => m.user_id === chip.resolvedEntityId);
        if (member && !chips.some(c => c.id === `person-${chip.resolvedEntityId}`)) {
          chips.push({
            id: `person-${chip.resolvedEntityId}`,
            label: member.display_name.toUpperCase(),
            onRemove: () => {
              setAssignedUserId(undefined);
              const updated = new Map(appliedChips);
              updated.delete(chip.id);
              setAppliedChips(updated);
            }
          });
        }
      }
    });
    
    // Add resolved team chips
    const resolvedTeamChips = [
      ...chipSuggestions.filter(c => c.type === 'team' && c.resolvedEntityId),
      ...Array.from(appliedChips.values()).filter(c => c.type === 'team' && c.resolvedEntityId)
    ];
    resolvedTeamChips.forEach(chip => {
      if (chip.resolvedEntityId && chip.resolvedEntityType === 'team') {
        const team = teams.find(t => t.id === chip.resolvedEntityId);
        if (team && !chips.some(c => c.id === `team-${chip.resolvedEntityId}`)) {
          chips.push({
            id: `team-${chip.resolvedEntityId}`,
            label: (team.name || '').toUpperCase(),
            onRemove: () => {
              setAssignedTeamIds(prev => prev.filter(id => id !== chip.resolvedEntityId));
              const updated = new Map(appliedChips);
              updated.delete(chip.id);
              setAppliedChips(updated);
            }
          });
        }
      }
    });
    
    // Add invite candidate chips (unknown persons) as fact chips
    const inviteChips = [
      ...chipSuggestions.filter(c => c.type === 'person' && c.metadata?.isInviteCandidate),
      ...Array.from(appliedChips.values()).filter(c => c.type === 'person' && c.metadata?.isInviteCandidate)
    ];
    inviteChips.forEach(chip => {
      if (chip.metadata?.inviteName && !chips.some(c => c.id === chip.id)) {
        chips.push({
          id: chip.id,
          label: `INVITE ${chip.metadata.inviteName.toUpperCase()}`,
          onRemove: () => {
            const updated = new Map(appliedChips);
            updated.delete(chip.id);
            setAppliedChips(updated);
            setSelectedChipIds(prev => prev.filter(id => id !== chip.id));
          }
        });
      }
    });
    
    // Add explicitly assigned user/teams (from form state)
    if (assignedUserId && !chips.some(c => c.id === `person-${assignedUserId}`)) {
      const member = members.find(m => m.user_id === assignedUserId);
      if (member) {
        chips.push({
          id: `person-${assignedUserId}`,
          label: member.display_name.toUpperCase(),
          onRemove: () => setAssignedUserId(undefined)
        });
      }
    }
    assignedTeamIds.forEach(teamId => {
      if (!chips.some(c => c.id === `team-${teamId}`)) {
        const team = teams.find(t => t.id === teamId);
        if (team) {
          chips.push({
            id: `team-${teamId}`,
            label: (team.name || '').toUpperCase(),
            onRemove: () => setAssignedTeamIds(prev => prev.filter(id => id !== teamId))
          });
        }
      }
    });
    
    return chips;
  }, [assignedUserId, assignedTeamIds, members, teams, chipSuggestions, appliedChips, selectedChipIds]);
  
  const whereFactChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove?: () => void; isSuggested?: boolean; tooltip?: string }> = [];
    
    // Add resolved property chips from suggestions (high-confidence extracted facts)
    const resolvedPropertyChips = [
      ...chipSuggestions.filter(c => c.type === 'property' && c.resolvedEntityId),
      ...Array.from(appliedChips.values()).filter(c => c.type === 'property' && c.resolvedEntityId)
    ];
    resolvedPropertyChips.forEach(chip => {
      if (chip.resolvedEntityId && chip.resolvedEntityType === 'property') {
        const property = properties.find(p => p.id === chip.resolvedEntityId);
        if (property && !chips.some(c => c.id === `property-${chip.resolvedEntityId}`)) {
          chips.push({
            id: `property-${chip.resolvedEntityId}`,
            label: (property.nickname || property.address || '').toUpperCase(),
            onRemove: () => {
              handlePropertyChange(selectedPropertyIds.filter(id => id !== chip.resolvedEntityId));
              const updated = new Map(appliedChips);
              updated.delete(chip.id);
              setAppliedChips(updated);
            }
          });
        }
      }
    });
    
    // Add resolved space chips from suggestions (high-confidence extracted facts)
    const resolvedSpaceChips = [
      ...chipSuggestions.filter(c => c.type === 'space' && c.resolvedEntityId),
      ...Array.from(appliedChips.values()).filter(c => c.type === 'space' && c.resolvedEntityId)
    ];
    resolvedSpaceChips.forEach(chip => {
      if (chip.resolvedEntityId && chip.resolvedEntityType === 'space') {
        const space = spaces.find(s => s.id === chip.resolvedEntityId);
        if (space && !chips.some(c => c.id === `space-${chip.resolvedEntityId}`)) {
          chips.push({
            id: `space-${chip.resolvedEntityId}`,
            label: space.name.toUpperCase(),
            onRemove: () => {
              setSelectedSpaceIds(prev => prev.filter(id => id !== chip.resolvedEntityId));
              const updated = new Map(appliedChips);
              updated.delete(chip.id);
              setAppliedChips(updated);
            }
          });
        }
      }
    });
    
    // Properties: Distinguish inferred (suggested) vs explicitly selected (fact)
    selectedPropertyIds.forEach(propId => {
      const property = properties.find(p => p.id === propId);
      if (property && !chips.some(c => c.id === `property-${propId}`)) {
        const isExplicit = explicitPropertyIds.has(propId);
        const isInferred = !isExplicit && (propId === defaultPropertyId || propId === lastUsedPropertyId);
        
        chips.push({
          id: `property-${propId}`,
          label: (property.nickname || property.address || '').toUpperCase(),
          isSuggested: isInferred,
          tooltip: isInferred ? "Suggested based on recent tasks" : undefined,
          onRemove: () => {
            handlePropertyChange(selectedPropertyIds.filter(id => id !== propId));
            setExplicitPropertyIds(prev => {
              const updated = new Set(prev);
              updated.delete(propId);
              return updated;
            });
          }
        });
      }
    });
    
    // Add explicitly selected spaces (from form state)
    selectedSpaceIds.forEach(spaceId => {
      if (!chips.some(c => c.id === `space-${spaceId}`)) {
        const space = spaces.find(s => s.id === spaceId);
        if (space) {
          chips.push({
            id: `space-${spaceId}`,
            label: space.name.toUpperCase(),
            onRemove: () => setSelectedSpaceIds(prev => prev.filter(id => id !== spaceId))
          });
        }
      }
    });
    
    return chips;
  }, [selectedPropertyIds, selectedSpaceIds, properties, spaces, chipSuggestions, appliedChips, explicitPropertyIds, defaultPropertyId, lastUsedPropertyId]);
  
  const whenFactChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove?: () => void; isSuggested?: boolean; tooltip?: string }> = [];
    
    // Add resolved date chips from suggestions (high-confidence extracted facts)
    const resolvedDateChips = [
      ...chipSuggestions.filter(c => c.type === 'date' && c.resolvedEntityId),
      ...Array.from(appliedChips.values()).filter(c => c.type === 'date' && c.resolvedEntityId)
    ];
    resolvedDateChips.forEach(chip => {
      if (chip.value && !chips.some(c => c.id === `date-${chip.id}`)) {
        // Parse date from chip value
        try {
          const date = new Date(chip.value);
          if (!isNaN(date.getTime())) {
            chips.push({
              id: `date-${chip.id}`,
              label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(),
              onRemove: () => {
                setDueDate('');
                const updated = new Map(appliedChips);
                updated.delete(chip.id);
                setAppliedChips(updated);
              }
            });
          }
        } catch (e) {
          // Invalid date, skip
        }
      }
    });
    
    // Add explicitly set due date (from form state)
    if (dueDate && !chips.some(c => c.id === 'due-date')) {
      const dateStr = dueDate.split('T')[0];
      const date = new Date(dateStr);
      chips.push({
        id: 'due-date',
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(),
        onRemove: () => setDueDate('')
      });
    }
    
    if (repeatRule) {
      chips.push({
        id: 'repeat',
        label: `REPEAT ${repeatRule.type.toUpperCase()}`,
        onRemove: () => setRepeatRule(undefined)
      });
    }
    return chips;
  }, [dueDate, repeatRule, chipSuggestions, appliedChips]);
  
  const whatFactChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove?: () => void; isSuggested?: boolean; tooltip?: string }> = [];
    
    // Add resolved asset chips from suggestions (high-confidence extracted facts)
    const resolvedAssetChips = [
      ...chipSuggestions.filter(c => c.type === 'asset' && c.resolvedEntityId),
      ...Array.from(appliedChips.values()).filter(c => c.type === 'asset' && c.resolvedEntityId)
    ];
    resolvedAssetChips.forEach(chip => {
      if (chip.resolvedEntityId && chip.resolvedEntityType === 'asset') {
        const asset = assets.find(a => a.id === chip.resolvedEntityId);
        if (asset && !chips.some(c => c.id === `asset-${chip.resolvedEntityId}`)) {
          chips.push({
            id: `asset-${chip.resolvedEntityId}`,
            label: asset.name.toUpperCase(),
            onRemove: () => {
              setSelectedAssetIds(prev => prev.filter(id => id !== chip.resolvedEntityId));
              const updated = new Map(appliedChips);
              updated.delete(chip.id);
              setAppliedChips(updated);
            }
          });
        }
      }
    });
    
    // Add explicitly selected assets (from form state)
    selectedAssetIds.forEach(assetId => {
      if (!chips.some(c => c.id === `asset-${assetId}`)) {
        const asset = assets.find(a => a.id === assetId);
        if (asset) {
          chips.push({
            id: `asset-${assetId}`,
            label: asset.name.toUpperCase(),
            onRemove: () => setSelectedAssetIds(prev => prev.filter(id => id !== assetId))
          });
        }
      }
    });
    
    return chips;
  }, [selectedAssetIds, assets, chipSuggestions, appliedChips]);
  
  const tagsFactChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove?: () => void }> = [];
    selectedThemeIds.forEach(themeId => {
      const theme = themes.find(t => t.id === themeId);
      if (theme) {
        chips.push({
          id: `theme-${themeId}`,
          label: theme.name.toUpperCase(),
          onRemove: () => setSelectedThemeIds(prev => prev.filter(id => id !== themeId))
        });
      }
    });
    return chips;
  }, [selectedThemeIds, themes]);
  
  const complianceFactChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove?: () => void }> = [];
    if (isCompliance) {
      chips.push({
        id: 'compliance',
        label: complianceLevel ? `COMPLIANCE ${complianceLevel.toUpperCase()}` : 'COMPLIANCE',
        onRemove: () => setIsCompliance(false)
      });
    }
    return chips;
  }, [isCompliance, complianceLevel]);
  
  // Handle section toggle (only one expanded at a time)
  const handleSectionToggle = (sectionId: string) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };
  
  // Handle chip removal (for fact chips in sections)
  const handleChipRemove = useCallback((chip: SuggestedChip) => {
    const updated = new Map(appliedChips);
    updated.delete(chip.id);
    setAppliedChips(updated);
    setSelectedChipIds(prev => prev.filter(id => id !== chip.id));
  }, [appliedChips]);
  
  // Handle chip selection and resolution (only for verb chips)
  const handleChipSelect = useCallback(async (chip: SuggestedChip) => {
    const isCurrentlySelected = selectedChipIds.includes(chip.id);
    
    // Map chip types to panel sections
    const chipTypeToSection: Record<string, string> = {
      'person': 'who',
      'team': 'who',
      'property': 'where',
      'space': 'where',
      'asset': 'what',
      'date': 'when',
      'priority': 'priority',
      'category': 'tags',
      'theme': 'tags',
    };
    
    // Open relevant section when chip is clicked
    const section = chipTypeToSection[chip.type];
    if (section) {
      setExpandedSection(section);
    }
    
    if (isCurrentlySelected) {
      // Toggle off
      setSelectedChipIds(prev => prev.filter(id => id !== chip.id));
      const updated = new Map(appliedChips);
      updated.delete(chip.id);
      setAppliedChips(updated);
      return;
    }
    
    // Toggle on - add to applied chips
    setSelectedChipIds(prev => [...prev, chip.id]);
    
    // Run resolution pipeline
    if (orgId) {
      // Load assets if needed
      let assets: Array<{ id: string; name: string; property_id: string; space_id?: string }> = [];
      if (chip.type === 'asset' && propertyId) {
        try {
          const { data } = await supabase
            .from('assets')
            .select('id, serial, property_id, space_id')
            .eq('org_id', orgId)
            .eq('property_id', propertyId);
          assets = (data || []).map(a => ({
            id: a.id,
            name: a.serial || 'Unnamed Asset',
            property_id: a.property_id,
            space_id: a.space_id || undefined
          }));
        } catch (err) {
          console.error('Error loading assets:', err);
        }
      }
      
      const entities: AvailableEntities = {
        spaces: spaces.map(s => ({ id: s.id, name: s.name, property_id: s.property_id })),
        members: members.map(m => ({ id: m.id, user_id: m.user_id, display_name: m.display_name })),
        teams: teams.map(t => ({ id: t.id, name: t.name || '' })),
        assets: assets,
        categories: categories.map(c => ({ id: c.id, name: c.name, parent_id: c.parent_id || undefined })),
        properties: [],
      };
      
      // Map ChipType to EntityType
      const chipTypeToEntityType: Record<string, EntityType> = {
        'person': 'person',
        'team': 'team',
        'space': 'space',
        'asset': 'asset',
        'category': 'category',
        'theme': 'category',
        'property': 'property',
      };
      
      const entityType = chipTypeToEntityType[chip.type] || 'category';
      
      // PREVENT AUTO-INSERTION: Only auto-resolve on exact matches, not fuzzy matches
      // User-typed terms should remain as primary suggestions until explicitly selected
      // Check resolution memory first (exact matches only)
      const memoryEntityId = await queryResolutionMemory(orgId, chip.label, entityType);
      
      let resolution;
      if (memoryEntityId) {
        // Memory match is considered exact - user has explicitly resolved this before
        resolution = {
          resolved: true,
          entityId: memoryEntityId,
          entityType: entityType,
          resolutionSource: 'exact' as const,
          confidence: 0.9
        };
      } else {
        // Run resolution pipeline
        resolution = await resolveChip(chip, entities, { propertyId, spaceId: selectedSpaceIds[0] });
        
        // PREVENT AUTO-INSERTION: Only auto-resolve if exact match (not fuzzy)
        // If resolution is fuzzy, treat as unresolved to preserve user's typed term
        if (resolution.resolved && resolution.resolutionSource === 'fuzzy') {
          // Check if chip label exactly matches the resolved entity name
          const resolvedEntity = findEntityById(resolution.entityId!, resolution.entityType!, entities);
          const isExactMatch = resolvedEntity && chip.label.toLowerCase().trim() === resolvedEntity.label.toLowerCase().trim();
          
          if (!isExactMatch) {
            // Fuzzy match - don't auto-resolve, keep as suggestion
            // User must explicitly click a DB match suggestion to resolve
            resolution = {
              resolved: false,
              requiresCreation: false,
              candidates: [{
                id: resolution.entityId!,
                label: resolvedEntity!.label,
                type: resolution.entityType!
              }],
              requiresUserChoice: true,
              confidence: resolution.confidence
            };
          }
        }
      }
      
      // Helper to find entity by ID
      function findEntityById(entityId: string, entityType: EntityType, entities: AvailableEntities): { id: string; label: string; type: EntityType } | null {
        switch (entityType) {
          case 'space':
            const space = entities.spaces.find(s => s.id === entityId);
            return space ? { id: space.id, label: space.name, type: 'space' } : null;
          case 'person':
            const member = entities.members.find(m => m.user_id === entityId || m.id === entityId);
            return member ? { id: member.user_id, label: member.display_name, type: 'person' } : null;
          case 'team':
            const team = entities.teams.find(t => t.id === entityId);
            return team ? { id: team.id, label: team.name || '', type: 'team' } : null;
          case 'asset':
            const asset = entities.assets.find(a => a.id === entityId);
            return asset ? { id: asset.id, label: asset.name, type: 'asset' } : null;
          case 'category':
            const category = entities.categories.find(c => c.id === entityId);
            return category ? { id: category.id, label: category.name, type: 'category' } : null;
          default:
            return null;
        }
      }
      
      // Update chip with resolution
      // Recurrence chips never block entity resolution - only space, asset, and person do
      const resolvedChip: SuggestedChip = {
        ...chip,
        state: resolution.resolved ? 'resolved' : resolution.requiresCreation ? 'blocked' : 'applied',
        resolvedEntityId: resolution.entityId,
        resolvedEntityType: resolution.entityType,
        resolutionSource: resolution.resolutionSource,
        resolutionConfidence: resolution.confidence,
        // Only space, asset, and person chips block entity resolution
        // Recurrence, date, priority, category, team chips never block
        blockingRequired: chip.type === 'space' || chip.type === 'asset' || chip.type === 'person',
      };
      
      const updated = new Map(appliedChips);
      updated.set(chip.id, resolvedChip);
      setAppliedChips(updated);
      
      // HIGH-CONFIDENCE FACTS: Automatically apply resolved chips to form state
      // This ensures facts appear immediately in section headers without user interaction
      if (resolution.resolved && resolution.entityId) {
        switch (chip.type) {
          case 'person':
            if (resolution.entityType === 'person' && !assignedUserId) {
              setAssignedUserId(resolution.entityId);
            }
            break;
          case 'team':
            if (resolution.entityType === 'team' && !assignedTeamIds.includes(resolution.entityId)) {
              setAssignedTeamIds(prev => [...prev, resolution.entityId]);
            }
            break;
          case 'space':
            if (resolution.entityType === 'space' && !selectedSpaceIds.includes(resolution.entityId)) {
              setSelectedSpaceIds(prev => [...prev, resolution.entityId]);
            }
            break;
          case 'asset':
            if (resolution.entityType === 'asset' && !selectedAssetIds.includes(resolution.entityId)) {
              setSelectedAssetIds(prev => [...prev, resolution.entityId]);
            }
            break;
          case 'date':
            if (chip.value) {
              try {
                const date = new Date(chip.value);
                if (!isNaN(date.getTime()) && !dueDate) {
                  // Format as ISO string for dueDate state
                  const isoDate = date.toISOString().split('T')[0] + 'T00:00:00';
                  setDueDate(isoDate);
                }
              } catch (e) {
                // Invalid date, skip
              }
            }
            break;
          case 'property':
            if (resolution.entityType === 'property' && !selectedPropertyIds.includes(resolution.entityId)) {
              handlePropertyChange([...selectedPropertyIds, resolution.entityId]);
            }
            break;
        }
      }
      
      // Store in memory if resolved
      if (resolution.resolved && resolution.entityId && orgId) {
        await storeResolutionMemory(orgId, chip.label, resolution.entityType!, resolution.entityId, resolution.confidence || 0.5);
      }
      
      // Log audit
      if (orgId && resolution.resolved) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            await logChipResolution(
              orgId,
              user.id,
              { chip: chip.label, type: chip.type },
              { resolved: resolution.resolved, entityId: resolution.entityId }
            );
          }
        } catch (err) {
          console.error('Error logging chip resolution:', err);
        }
      }
      
      // Handle auto-open sections for assets
      if (chip.type === 'asset' && !propertyId) {
        setExpandedSection('where');
      } else if (chip.type === 'asset' && propertyId && selectedSpaceIds.length === 0) {
        setExpandedSection('where');
      }
    }
  }, [selectedChipIds, appliedChips, orgId, spaces, members, teams, categories, propertyId, selectedSpaceIds]);

  // Create verb chips with handlers after handleChipSelect is defined
  const verbChipsBySection = useMemo(() => {
    const result: Record<string, Array<{ id: string; label: string; onSelect?: () => void; chip?: SuggestedChip }>> = {
      'who': [],
      'where': [],
      'when': [],
      'what': [],
      'tags': [],
      'compliance': [],
    };
    
    Object.keys(verbChipsBySectionBase).forEach(section => {
      result[section] = verbChipsBySectionBase[section].map(item => ({
        ...item,
        onSelect: () => handleChipSelect(item.chip)
      }));
    });
    
    return result;
  }, [verbChipsBySectionBase, handleChipSelect]);
  
  // Validate resolution truth and update clarity state
  useEffect(() => {
    const blockingIssues: string[] = [];
    const warningIssues: string[] = [];
    
    // Check all applied chips
    appliedChips.forEach((chip) => {
      if (chip.blockingRequired && !chip.resolvedEntityId) {
        if (chip.type === 'space' && !propertyId) {
          blockingIssues.push(`"${chip.label}" was found, but no property is selected. Which property does this apply to?`);
        } else if (chip.type === 'asset' && !propertyId) {
          blockingIssues.push(`"${chip.label}" needs a property. Pick one to continue.`);
        } else if (chip.type === 'person') {
          blockingIssues.push(`Filla couldn't find "${chip.label}". Choose an existing contact or invite someone new.`);
        } else {
          blockingIssues.push(`"${chip.label}" needs sorting before creating this task.`);
        }
      }
    });
    
    // Check property requirement for spaces/assets
    const hasSpaceOrAssetChips = Array.from(appliedChips.values()).some(
      c => (c.type === 'space' || c.type === 'asset') && !c.resolvedEntityId
    );
    if (hasSpaceOrAssetChips && !propertyId) {
      blockingIssues.push('Pick a property when adding spaces or assets.');
    }
    
    if (blockingIssues.length > 0) {
      setClarityState({
        severity: 'blocking',
        message: `Resolve before creating. ${blockingIssues[0]}`,
      });
    } else if (warningIssues.length > 0) {
      setClarityState({
        severity: 'warning',
        message: warningIssues[0],
      });
    } else {
      setClarityState(null);
    }
  }, [appliedChips, propertyId]);
  
  // Auto-update title from AI when user hasn't manually edited
  useEffect(() => {
    if (aiResult?.title && !userEditedTitle) {
      // Capitalize first letter of AI title
      const capitalizedTitle = aiResult.title.charAt(0).toUpperCase() + aiResult.title.slice(1);
      setAiTitleGenerated(capitalizedTitle);
      setTitle(capitalizedTitle);
      setShowTitleField(true);
    }
  }, [aiResult?.title, userEditedTitle]);

  // Auto-apply AI suggestions when received
  useEffect(() => {
    if (!aiResult) return;
    
    // Auto-set priority from AI
    if (aiResult.priority === "HIGH" || aiResult.priority === "high") {
      setPriority("high");
    } else if (aiResult.priority === "URGENT" || aiResult.priority === "urgent") {
      setPriority("urgent");
    } else if (aiResult.priority === "MEDIUM" || aiResult.priority === "medium") {
      setPriority("medium");
    } else if (aiResult.priority === "LOW" || aiResult.priority === "low") {
      setPriority("low");
    }
    
    // Auto-set date suggestions including weekdays
    if (aiResult.date) {
      const today = new Date();
      const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      
      if (aiResult.date === "today") {
        setDueDate(today.toISOString().split("T")[0]);
      } else if (aiResult.date === "tomorrow") {
        today.setDate(today.getDate() + 1);
        setDueDate(today.toISOString().split("T")[0]);
      } else if (aiResult.date === "next_week") {
        today.setDate(today.getDate() + 7);
        setDueDate(today.toISOString().split("T")[0]);
      } else if (weekdays.includes(aiResult.date.toLowerCase())) {
        // Calculate next occurrence of the weekday
        const targetDay = weekdays.indexOf(aiResult.date.toLowerCase());
        const currentDay = today.getDay();
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7; // If today or in the past, go to next week
        today.setDate(today.getDate() + daysToAdd);
        setDueDate(today.toISOString().split("T")[0]);
      }
    }
    
    // Auto-enable compliance if signature is suggested
    if (aiResult.signature && !isCompliance) {
      setIsCompliance(true);
      setShowAdvanced(true);
    }
  }, [aiResult]);

  // Hide/show title field based on description and restore AI title if available
  useEffect(() => {
    if (!description.trim()) {
      setShowTitleField(false);
      setUserEditedTitle(false);
      // Only clear title if user hasn't edited it and there's no AI-generated title
      if (!userEditedTitle && !aiTitleGenerated) {
        setTitle("");
      }
    } else {
      // When description becomes non-empty, restore AI title if available and not user-edited
      if (aiTitleGenerated && !userEditedTitle && !title.trim()) {
        setTitle(aiTitleGenerated);
        setShowTitleField(true);
      } else if (title.trim() && !showTitleField) {
        // If title exists but field is hidden, show it
        setShowTitleField(true);
      }
    }
  }, [description, userEditedTitle, aiTitleGenerated, title, showTitleField]);
  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setPropertyId(defaultPropertyId || "");
    setSelectedPropertyIds(defaultPropertyId ? [defaultPropertyId] : []);
    setSelectedSpaceIds([]);
    setPriority("medium");
    setDueDate(defaultDueDate || "");
    setRepeatRule(undefined);
    setAssignedUserId(undefined);
    setAssignedTeamIds([]);
    setPendingInvitations([]);
    setIsCompliance(false);
    setComplianceLevel("");
    setAnnotationRequired(false);
    setTemplateId("");
    setSubtasks([]);
    setSelectedThemeIds([]);
    setSelectedAssetIds([]);
    setImages([]);
    setShowAdvanced(false);
    setExpandedSection(null);
    // Reset AI-related state
    setAiTitleGenerated("");
    setUserEditedTitle(false);
    setShowTitleField(false);
  }, [defaultPropertyId, defaultDueDate]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open, resetForm]);

  const handleSubmit = async () => {
    // Validation: Check resolution truth (Final Pre-Build Rule)
    const blockingChips = Array.from(appliedChips.values()).filter(
      chip => chip.blockingRequired && !chip.resolvedEntityId
    );
    
    if (blockingChips.length > 0) {
      const firstBlocking = blockingChips[0];
      toast({
        title: "Sort this first",
        description: `"${firstBlocking.label}" needs sorting before creating the task.`,
        variant: "destructive"
      });
      return;
    }
    
    // Check property requirement for spaces/assets
    const hasSpaceOrAssetChips = Array.from(appliedChips.values()).some(
      c => (c.type === 'space' || c.type === 'asset')
    );
    if (hasSpaceOrAssetChips && !propertyId) {
      toast({
        title: "Pick a property",
        description: "Choose a property when adding spaces or assets.",
        variant: "destructive"
      });
      return;
    }
    
    // Auto-generate title if empty
    let finalTitle = title.trim();
    if (!finalTitle) {
      // Try AI-generated title first, then description
      if (aiTitleGenerated && aiTitleGenerated.trim()) {
        finalTitle = aiTitleGenerated.trim();
      } else if (description && description.trim()) {
        finalTitle = description.trim().substring(0, 50);
        if (description.trim().length > 50) {
          finalTitle += "...";
        }
      }
    }
    
    if (!finalTitle || !finalTitle.trim()) {
      toast({
        title: "Add a description",
        description: "Enter a task title or description to continue.",
        variant: "destructive"
      });
      return;
    }
    
    if (orgLoading) {
      toast({
        title: "Loading",
        description: "Please wait while we verify your account.",
        variant: "default"
      });
      return;
    }
    
    if (!orgId) {
      toast({
        title: "Not signed in",
        description: "Log in to create tasks.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      // ============================================================
      // JUST-IN-TIME GHOST CHIP CREATION
      // ============================================================
      // Scan for ghost chips and create them before saving the task
      let resolvedSpaceIds = [...selectedSpaceIds];
      let resolvedThemeIds = [...selectedThemeIds];
      let resolvedAssetIds: string[] = []; // Will be populated if assets are added later
      
      // Process Ghost Spaces
      const ghostSpaces = selectedSpaceIds.filter(id => id.startsWith('ghost-space-'));
      for (const ghostId of ghostSpaces) {
        const spaceName = ghostId.replace('ghost-space-', '');
        
        if (selectedPropertyIds.length === 0) {
          throw new Error(`Can't create space "${spaceName}" without picking a property`);
        }
        
        // Use first property for space creation
        const spacePropertyId = selectedPropertyIds[0];
        const { data: newSpace, error: spaceError } = await supabase
          .from("spaces")
          .insert({
            org_id: orgId,
            property_id: spacePropertyId,
            name: spaceName,
          })
          .select("id")
          .single();
        
        if (spaceError) {
          console.error("Error creating space:", spaceError);
          throw new Error(`Couldn't create space "${spaceName}": ${spaceError.message}`);
        }
        
        if (!newSpace) {
          throw new Error(`Couldn't create space "${spaceName}": no data returned`);
        }
        
        // Replace ghost ID with real ID
        resolvedSpaceIds = resolvedSpaceIds.map(id => id === ghostId ? newSpace.id : id);
        
        toast({
          title: "Created new Space",
          description: spaceName,
        });
      }
      
      // Process Ghost Themes
      const ghostThemes = selectedThemeIds.filter(id => id.startsWith('ghost-theme-'));
      for (const ghostId of ghostThemes) {
        // Extract name and type from ghost ID: ghost-theme-{name}-{type}
        const match = ghostId.match(/^ghost-theme-(.+?)-(.+)$/);
        if (!match) {
          console.warn(`Invalid ghost theme ID format: ${ghostId}`);
          continue;
        }
        
        const [, themeName, themeType] = match;
        
        const { data: newTheme, error: themeError } = await supabase
          .from("themes")
          .insert({
            org_id: orgId,
            name: themeName,
            type: themeType as 'category' | 'project' | 'tag' | 'group',
          })
          .select("id")
          .single();
        
        if (themeError) {
          console.error("Error creating theme:", themeError);
          throw new Error(`Couldn't create theme "${themeName}": ${themeError.message}`);
        }
        
        if (!newTheme) {
          throw new Error(`Couldn't create theme "${themeName}": no data returned`);
        }
        
        // Replace ghost ID with real ID
        resolvedThemeIds = resolvedThemeIds.map(id => id === ghostId ? newTheme.id : id);
        
        toast({
          title: "Created new Theme",
          description: themeName,
        });
      }
      
      // Process Ghost Assets (if assets are implemented)
      // For now, assets section doesn't have selectedAssetIds state, but we'll prepare for it
      // const ghostAssets = selectedAssetIds.filter(id => id.startsWith('ghost-asset-'));
      // for (const ghostId of ghostAssets) {
      //   const assetName = ghostId.replace('ghost-asset-', '');
      //   
      //   if (!propertyId) {
      //     throw new Error(`Cannot create asset "${assetName}" without a property selected`);
      //   }
      //   
      //   const { data: newAsset, error: assetError } = await supabase
      //     .from("assets")
      //     .insert({
      //       org_id: orgId,
      //       property_id: propertyId,
      //       title: assetName,
      //     })
      //     .select("id")
      //     .single();
      //   
      //   if (assetError) {
      //     console.error("Error creating asset:", assetError);
      //     throw new Error(`Failed to create asset "${assetName}": ${assetError.message}`);
      //   }
      //   
      //   if (!newAsset) {
      //     throw new Error(`Failed to create asset "${assetName}": no data returned`);
      //   }
      //   
      //   resolvedAssetIds = resolvedAssetIds.map(id => id === ghostId ? newAsset.id : id);
      //   
      //   toast({
      //     title: "Created new Asset",
      //     description: assetName,
      //   });
      // }
      
      // Priority will be normalized by the RPC function
      // Frontend uses: 'low', 'medium', 'high', 'urgent'
      // RPC will map 'medium' to 'normal' automatically
      const dbPriority = priority;
      
      // Convert dueDate (YYYY-MM-DD) to TIMESTAMPTZ
      let dueDateValue: string | null = null;
      if (dueDate) {
        // If it's just a date string, convert to full timestamp at start of day
        const dateObj = new Date(dueDate);
        dueDateValue = dateObj.toISOString();
      }
      
      // Check if assigned user is a pending invitation
      const isPendingInvitation = assignedUserId?.startsWith('pending-');
      let finalAssignedUserId: string | null = null;
      
      if (assignedUserId && !isPendingInvitation) {
        finalAssignedUserId = assignedUserId;
      }
      // If it's a pending invitation, we'll handle it after task creation
      
      // Simplified: Use direct insert instead of RPC for reliability
      // RLS is now fixed, so we can use standard Supabase client
      console.log('[CreateTaskModal] Creating task with:', {
        orgId,
        title: finalTitle,
        propertyId: propertyId || null,
        priority: dbPriority,
        dueDate: dueDateValue,
        description: description.trim() || null,
        assignedUserId: finalAssignedUserId,
        pendingInvitations: pendingInvitations.length,
      });
      
      const { data: newTask, error: createError } = await supabase
        .from("tasks")
        .insert({
          org_id: orgId,
          title: finalTitle,
          property_id: propertyId || null,
          priority: dbPriority,
          due_date: dueDateValue,
          description: description.trim() || null,
          assigned_user_id: finalAssignedUserId,
          status: 'open',
        })
        .select()
        .single();

      if (createError) {
        console.error("[CreateTaskModal] Task creation error:", createError);
        throw createError;
      }

      if (!newTask) {
        throw new Error("Couldn't create task: no data returned");
      }

      const taskId = newTask.id;
      console.log('[CreateTaskModal] Task created successfully:', { taskId, newTask });
      
      // Upload images in background (non-blocking)
      if (images.length > 0 && taskId && orgId) {
        // Update taskId in ImageUploadSection for annotation support
        // Upload images in background
        const uploadPromises = images.map(async (tempImage, index) => {
          try {
            // Update status to uploading
            setImages(prev => {
              const updated = [...prev];
              updated[index] = { ...updated[index], upload_status: 'uploading' };
              return updated;
            });

            const imageUuid = crypto.randomUUID();
            const basePath = `org/${orgId}/tasks/${taskId}/images/${imageUuid}`;
            
            // Upload thumbnail
            const thumbnailPath = `${basePath}/thumb.webp`;
            const { error: thumbError } = await supabase.storage
              .from("task-images")
              .upload(thumbnailPath, tempImage.thumbnail_blob, {
                contentType: 'image/webp',
                cacheControl: '31536000', // 1 year
              });

            if (thumbError) throw thumbError;

            // Upload optimized
            const optimizedPath = `${basePath}/optimized.webp`;
            const { error: optError } = await supabase.storage
              .from("task-images")
              .upload(optimizedPath, tempImage.optimized_blob, {
                contentType: 'image/webp',
                cacheControl: '31536000',
              });

            if (optError) throw optError;

            // Get public URLs
            const { data: thumbUrl } = supabase.storage
              .from("task-images")
              .getPublicUrl(thumbnailPath);
            
            const { data: optUrl } = supabase.storage
              .from("task-images")
              .getPublicUrl(optimizedPath);

            // Create attachment record with annotations
            const { data: attachment, error: attachError } = await supabase
              .from("attachments")
              .insert({
                org_id: orgId,
                parent_type: "task",
                parent_id: taskId,
                file_url: optUrl.publicUrl,
                thumbnail_url: thumbUrl.publicUrl,
                optimized_url: optUrl.publicUrl,
                file_name: tempImage.display_name,
                file_type: 'image/webp',
                file_size: tempImage.optimized_blob.size,
                annotation_json: tempImage.annotation_json || [],
                upload_status: 'complete',
              })
              .select()
              .single();

            if (attachError) throw attachError;

            // Create annotation record if annotations exist
            if (tempImage.annotation_json && tempImage.annotation_json.length > 0 && attachment) {
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                await supabase
                  .from("task_image_annotations")
                  .insert({
                    task_id: taskId,
                    image_id: attachment.id,
                    created_by: user.id,
                    annotations: tempImage.annotation_json,
                  });
              }
            }

            // Update status to uploaded
            setImages(prev => {
              const updated = [...prev];
              updated[index] = { 
                ...updated[index], 
                upload_status: 'uploaded', 
                uploaded: true,
                storage_paths: {
                  thumbnail: thumbnailPath,
                  optimized: optimizedPath,
                }
              };
              return updated;
            });

            // Cleanup blob URLs
            cleanupTempImage(tempImage);

            return attachment;
          } catch (error: any) {
            console.error(`Error uploading image ${index}:`, error);
            
            // Update status to failed
            setImages(prev => {
              const updated = [...prev];
              updated[index] = { 
                ...updated[index], 
                upload_status: 'failed',
                upload_error: error.message 
              };
              return updated;
            });

            toast({
              title: "Image upload failed",
              description: `Couldn't upload "${tempImage.display_name}". You can retry later.`,
              variant: "destructive",
            });

            return null;
          }
        });

        // Don't await - let uploads happen in background
        Promise.all(uploadPromises).then(() => {
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
          queryClient.invalidateQueries({ queryKey: ["task-details", orgId, taskId] });
        });
      }
      
      // Link spaces to task via task_spaces junction table
      if (resolvedSpaceIds.length > 0) {
        const spaceInserts = resolvedSpaceIds.map(spaceId => ({
          task_id: taskId,
          space_id: spaceId,
        }));
        
        const { error: spaceLinkError } = await supabase
          .from("task_spaces")
          .insert(spaceInserts);
        
        if (spaceLinkError) {
          console.error("Error linking spaces to task:", spaceLinkError);
          // Don't throw - task is already created, just log the error
        }
      }
      
      // Link themes to task via task_themes junction table
      if (resolvedThemeIds.length > 0) {
        const themeInserts = resolvedThemeIds.map(themeId => ({
          task_id: taskId,
          theme_id: themeId,
        }));
        
        console.log('[CreateTaskModal] Linking themes:', { taskId, themeIds: resolvedThemeIds });
        const { error: themeLinkError } = await supabase
          .from("task_themes")
          .insert(themeInserts);
        
        if (themeLinkError) {
          console.error("[CreateTaskModal] Error linking themes to task:", themeLinkError);
          // Don't throw - task is already created, just log the error
        } else {
          console.log('[CreateTaskModal] Themes linked successfully');
        }
      }
      
      // Link teams to task via task_teams junction table
      if (assignedTeamIds.length > 0) {
        const teamInserts = assignedTeamIds.map(teamId => ({
          task_id: taskId,
          team_id: teamId,
        }));
        
        console.log('[CreateTaskModal] Linking teams:', { taskId, teamIds: assignedTeamIds });
        const { error: teamLinkError } = await supabase
          .from("task_teams")
          .insert(teamInserts);
        
        if (teamLinkError) {
          console.error("[CreateTaskModal] Error linking teams to task:", teamLinkError);
          // Don't throw - task is already created, just log the error
        } else {
          console.log('[CreateTaskModal] Teams linked successfully');
        }
      }
      
      // Handle pending invitations
      if (isPendingInvitation && pendingInvitations.length > 0) {
        // Find the pending invitation that matches the assigned user
        const email = assignedUserId?.replace('pending-', '');
        const pendingInv = pendingInvitations.find(inv => inv.email === email);
        
        if (pendingInv) {
          // TODO: Create invitation record and send email with magic link
          // For now, log that we need to handle this
          console.log('[CreateTaskModal] Pending invitation for task:', {
            taskId,
            invitation: pendingInv,
          });
          
          // The chip is already created and dimmed in the UI
          // When the user validates/registers or visits via magic link,
          // we'll need to update the task's assigned_user_id
        }
      }
      
      // Show final success toast
      const createdEntities = [];
      if (ghostSpaces.length > 0) createdEntities.push(`${ghostSpaces.length} space${ghostSpaces.length > 1 ? 's' : ''}`);
      if (ghostThemes.length > 0) createdEntities.push(`${ghostThemes.length} theme${ghostThemes.length > 1 ? 's' : ''}`);
      
      console.log('[CreateTaskModal] Task creation complete:', {
        taskId,
        orgId,
        imageCount: images.length,
      });
      
      // Invalidate queries to refresh task lists and details
      // If images were uploaded, we already invalidated above, but invalidate again
      // after a delay to pick up thumbnails processed by the edge function
      if (images.length > 0) {
        // Wait 2 seconds for edge function to process thumbnails, then invalidate again
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
          queryClient.invalidateQueries({ queryKey: ["task-details", orgId, taskId] });
        }, 2000);
      } else {
        // Immediate invalidation if no images
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
        queryClient.invalidateQueries({ queryKey: ["task-details", orgId, taskId] });
      }
      
      toast({
        title: "Task created",
        description: createdEntities.length > 0 
          ? `Task created. Created new ${createdEntities.join(' and ')}.`
          : "Your task has been added successfully."
      });
      resetForm();
      onOpenChange(false);
      onTaskCreated?.(taskId);
    } catch (error: any) {
      console.error("Create task failed:", error);
      toast({
        title: "Couldn't create task",
        description: error.message || "Something didn't work. Try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  const content = <div className="flex flex-col h-full max-h-[85vh]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/30">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          Create Task
        </h2>
        <button 
          type="button"
          onClick={() => onOpenChange(false)} 
          className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Image Upload Icons */}
        <ImageUploadSection images={images} onImagesChange={setImages} taskId={undefined} />

        {/* AI-Generated Title (appears after AI responds) */}
        <div className={cn(
          "transition-all duration-300 ease-out mt-[6px]",
          showTitleField ? "opacity-100 max-h-24" : "opacity-0 max-h-0 overflow-hidden"
        )}>
          {showTitleField && (
            <div className="space-y-2">
              <label className="text-[12px] font-mono uppercase tracking-wider text-primary flex items-center gap-1.5">
                <FillaIcon size={12} className="text-primary" />
                AI Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setUserEditedTitle(true);
                  setTitle(e.target.value);
                  if (e.target.value.trim() === "") {
                    setUserEditedTitle(false);
                  }
                }}
                className="w-full px-4 py-3 rounded-xl bg-input shadow-engraved focus:outline-none focus:ring-2 focus:ring-primary/30 font-sans text-lg transition-shadow"
                placeholder="Generated title…"
              />
            </div>
          )}
        </div>

        {/* Combined Description + Subtasks Panel */}
        <SubtasksSection subtasks={subtasks} onSubtasksChange={setSubtasks} description={description} onDescriptionChange={setDescription} className="bg-transparent" />

        {/* Six Vertically Stacked Sections - System-level section model */}
        <div className="space-y-1">
          {/* 1. Who — People & Teams - Single-line stacked row */}
          <div className="w-full flex items-center gap-2">
            <div className="h-4 w-4 flex items-center justify-center shrink-0 text-muted-foreground">
              <User className="h-4 w-4" />
            </div>
            <WhoSectionRow
              assignedUserId={assignedUserId}
              assignedTeamIds={assignedTeamIds}
              onUserChange={setAssignedUserId}
              onTeamsChange={setAssignedTeamIds}
              pendingInvitations={pendingInvitations}
              onPendingInvitationsChange={setPendingInvitations}
              onInviteToOrg={() => {
                toast({ title: "Invite functionality coming soon" });
              }}
              onAddAsContractor={() => {
                toast({ title: "Contractor creation coming soon" });
              }}
              additionalFactChips={whoFactChips.filter(chip => chip.label.startsWith('INVITE '))}
            />
          </div>

          {/* 2. Where — Property, Space, Subspace */}
          <TaskSection
            id="where"
            icon={<MapPin className="h-4 w-4" />}
            factChips={whereFactChips}
            verbChips={verbChipsBySection.where}
            isExpanded={expandedSection === 'where'}
            onToggle={() => handleSectionToggle('where')}
          >
            <WherePanel 
              propertyId={propertyId} 
              spaceIds={selectedSpaceIds} 
              onPropertyChange={handlePropertyChange} 
              onSpacesChange={setSelectedSpaceIds}
              suggestedSpaces={aiResult?.spaces?.map(s => s.name) || []}
              defaultPropertyId={defaultPropertyId}
              instructionBlock={instructionBlock}
              onInstructionDismiss={() => setInstructionBlock(null)}
            />
          </TaskSection>

          {/* 3. When — Date, Time, Recurrence */}
          <TaskSection
            id="when"
            icon={<Calendar className="h-4 w-4" />}
            factChips={whenFactChips}
            verbChips={verbChipsBySection.when}
            isExpanded={expandedSection === 'when'}
            onToggle={() => handleSectionToggle('when')}
          >
            <WhenPanel 
              dueDate={dueDate} 
              repeatRule={repeatRule} 
              onDueDateChange={setDueDate} 
              onRepeatRuleChange={setRepeatRule} 
            />
          </TaskSection>

          {/* 4. What — Asset */}
          <TaskSection
            id="what"
            icon={<Box className="h-4 w-4" />}
            factChips={whatFactChips}
            verbChips={verbChipsBySection.what}
            isExpanded={expandedSection === 'what'}
            onToggle={() => handleSectionToggle('what')}
          >
            {propertyId ? (
              <AssetPanel
                propertyId={propertyId}
                spaceId={selectedSpaceIds[0]}
                selectedAssetIds={selectedAssetIds}
                onAssetsChange={setSelectedAssetIds}
                suggestedAssets={aiResult?.assets || []}
                instructionBlock={instructionBlock}
                onInstructionDismiss={() => setInstructionBlock(null)}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Select a property first</p>
            )}
          </TaskSection>

          {/* 5. Tags — Classification */}
          <TaskSection
            id="tags"
            icon={<Tag className="h-4 w-4" />}
            factChips={tagsFactChips}
            verbChips={verbChipsBySection.tags}
            isExpanded={expandedSection === 'tags'}
            onToggle={() => handleSectionToggle('tags')}
          >
            <CategoryPanel 
              selectedThemeIds={selectedThemeIds} 
              onThemesChange={setSelectedThemeIds}
              suggestedThemes={aiResult?.themes?.map(t => ({ name: t.name, type: t.type })) || []}
              instructionBlock={instructionBlock}
              onInstructionDismiss={() => setInstructionBlock(null)}
            />
          </TaskSection>

          {/* 6. Compliance — Statutory & Safety */}
          <TaskSection
            id="compliance"
            icon={<Shield className="h-4 w-4" />}
            factChips={complianceFactChips}
            verbChips={verbChipsBySection.compliance}
            isExpanded={expandedSection === 'compliance'}
            onToggle={() => handleSectionToggle('compliance')}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="compliance" className="text-sm">Compliance Task</Label>
                  <p className="text-xs text-muted-foreground">Mark as regulatory requirement</p>
                </div>
                <Switch id="compliance" checked={isCompliance} onCheckedChange={setIsCompliance} />
              </div>
              {isCompliance && (
                <div className="space-y-2">
                  <Label className="text-xs">Compliance Level</Label>
                  <Select value={complianceLevel} onValueChange={setComplianceLevel}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </TaskSection>
        </div>


        {/* Checklist Template */}
        {templates.length > 0 && <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-muted-foreground" />
              Apply Template
            </Label>
            <Select value={templateId || undefined} onValueChange={(val) => setTemplateId(val === "none" ? "" : val)}>
              <SelectTrigger className="shadow-engraved">
                <SelectValue placeholder="Choose a checklist template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {templates.map(template => <SelectItem key={template.id} value={template.id}>
                    {template.icon && <span className="mr-2">{template.icon}</span>}
                    {template.name}
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>}

        {/* Advanced Options */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="annotation" className="text-sm">Requires Photo Annotation</Label>
              <p className="text-xs text-muted-foreground">Enforce photo markup on completion</p>
            </div>
            <Switch id="annotation" checked={annotationRequired} onCheckedChange={setAnnotationRequired} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-3 p-4 border-t border-border/30 bg-card/80 backdrop-blur">
        {/* Verb Chips Clarity Block - Shows when unresolved chips exist */}
        {verbChips.length > 0 && (
          <div className="w-full px-4 py-3 rounded-[5px] bg-muted/30 border border-border/40">
            <p className="text-sm text-foreground/80 mb-2 leading-relaxed">
              {verbChips.length === 1 
                ? "One thing to sort before creating this task."
                : "A few things to sort before creating this task."}
            </p>
            <div className="flex flex-wrap gap-2">
              {verbChips.map((chip) => {
                const verbLabel = generateVerbLabel(chip);
                return (
                  <Chip
                    key={chip.id}
                    role="verb"
                    label={verbLabel}
                    onSelect={() => handleChipSelect(chip)}
                    animate={false}
                  />
                );
              })}
            </div>
          </div>
        )}
        
        {/* Clarity State */}
        {clarityState && (
          <ClarityState
            severity={clarityState.severity}
            message={clarityState.message}
          />
        )}
        
        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 shadow-e1" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          {clarityState?.severity === 'blocking' ? (
            <Button 
              variant="outline" 
              className="flex-1 shadow-e1" 
              onClick={async () => {
                // Save as draft functionality
                toast({
                  title: "Draft saved",
                  description: "Task saved as draft. You can continue later.",
                });
                onOpenChange(false);
              }}
              disabled={isSubmitting}
            >
              Save Draft
            </Button>
          ) : (
            <Button 
              className="flex-1 shadow-primary-btn" 
              onClick={handleSubmit} 
              disabled={isSubmitting || (clarityState?.severity === 'blocking') || verbChips.length > 0}
            >
              {isSubmitting ? "Creating..." : "Create Task"}
            </Button>
          )}
        </div>
      </div>
    </div>;

  // Column variant: render directly without Dialog/Drawer wrapper
  if (variant === "column") {
    if (!open) return null;
    return (
      <div className="h-full flex flex-col bg-background">
        {content}
      </div>
    );
  }

  // Modal variant: Mobile: Bottom sheet drawer, Desktop: Center dialog
  if (isMobile) {
    return <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[95vh]">
          {content}
        </DrawerContent>
      </Drawer>;
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>Create a new task with details, assignments, and metadata</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>;
}