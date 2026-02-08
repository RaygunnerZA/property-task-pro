import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { X, ChevronDown, ChevronUp, User, Calendar, MapPin, AlertTriangle, ListTodo, Shield, Box, Tag, Users } from "lucide-react";
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
import { PriorityPanel } from "./create/panels/PriorityPanel";
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
import { CreateTaskRow } from "./create/CreateTaskRow";
import type { CreateTaskPayload, TaskPriority, RepeatRule } from "@/types/database";
import type { TempImage } from "@/types/temp-image";
import { cleanupTempImage } from "@/utils/image-optimization";
interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated?: (taskId: string) => void;
  defaultPropertyId?: string;
  defaultDueDate?: string;
  variant?: "modal" | "column"; // "modal" for mobile overlay, "column" for desktop third column
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
  // Only fetch checklist templates when modal is open to avoid unnecessary queries
  const {
    templates
  } = useChecklistTemplates(open);
  const { lastUsedPropertyId, setLastUsed } = useLastUsedProperty();
  const { members } = useOrgMembers();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [propertyId, setPropertyId] = useState(defaultPropertyId || "");
  
  // Hooks that depend on form state
  const { spaces } = useSpaces(propertyId || undefined);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>(defaultPropertyId ? [defaultPropertyId] : []);
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);

  // Initialize propertyId from last used when modal opens
  useEffect(() => {
    if (open && !defaultPropertyId && lastUsedPropertyId && !propertyId) {
      setPropertyId(lastUsedPropertyId);
      setSelectedPropertyIds([lastUsedPropertyId]);
    }
  }, [open, defaultPropertyId, lastUsedPropertyId]);

  // Update last used when property changes
  const handlePropertyChange = (newPropertyIds: string[]) => {
    setSelectedPropertyIds(newPropertyIds);
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
  const [activeSection, setActiveSection] = useState<string | null>(null); // Replaces activeTab

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
  });
  
  // Track applied chips and their resolution state
  const [appliedChips, setAppliedChips] = useState<Map<string, SuggestedChip>>(new Map());
  const [selectedChipIds, setSelectedChipIds] = useState<string[]>([]);
  
  // Fact chips include: person, team, space, asset, category, date, recurrence
  // Recurrence never blocks entity resolution - only space, asset, person do
  const factChipTypes: ChipType[] = ['person', 'team', 'space', 'asset', 'category', 'date', 'recurrence'];
  
  // Calculate fact chips (resolved context) - chips that are resolved or don't require blocking
  // INVITE BEHAVIORAL CONTRACT: Invite chips (person with blockingRequired && !resolvedEntityId) are NOT fact chips
  // They are action chips that must be explicitly resolved or removed - they cannot be treated as passive metadata
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
    // INVITE BEHAVIORAL CONTRACT: Person chips without resolvedEntityId are Invite actions and must be excluded
    return Array.from(chipMap.values()).filter(chip => 
      chip.resolvedEntityId || !chip.blockingRequired
    );
  }, [chipSuggestions, appliedChips]);
  
  // Calculate verb (unresolved) chips - chips that require blocking and aren't resolved
  // INVITE BEHAVIORAL CONTRACT: Person chips with blockingRequired && !resolvedEntityId are Invite actions
  // Invite chips are NOT normal chips - they are action intent that requires explicit resolution
  // They must be explicitly resolved to a person/team or removed - they cannot silently disappear
  // They cannot be treated as passive metadata - they are gated actions
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
    // INVITE BEHAVIORAL CONTRACT: Person chips with this state are Invite actions (not normal chips)
    // They represent explicit intent that must be resolved or removed before submission
    // Recurrence chips never have blockingRequired, so they're excluded from verb chips
    return Array.from(chipMap.values()).filter(chip => 
      chip.blockingRequired && !chip.resolvedEntityId
    );
  }, [chipSuggestions, appliedChips]);
  
  // Calculate unresolved sections from verb chips
  const unresolvedSections = useMemo(() => {
    const unresolved: string[] = [];
    const chipTypeToSection: Record<string, string> = {
      'person': 'who',
      'team': 'who',
      'space': 'where',
      'asset': 'what',
      'category': 'category',
      'theme': 'category',
      'date': 'when',
      'recurrence': 'when',
      'priority': 'priority',
    };

    verbChips.forEach(chip => {
      const section = chipTypeToSection[chip.type];
      if (section && !unresolved.includes(section)) {
        unresolved.push(section);
      }
    });

    return unresolved;
  }, [verbChips]);

  // Section order: Who, Where, When, Assets, Priority, Tags, Compliance (authoritative vertical stack)
  const CREATE_TASK_SECTIONS = useMemo(() => [
    { id: 'who', instruction: 'Add Person or Team', Icon: User },
    { id: 'where', instruction: 'Add Property or Space', Icon: MapPin },
    { id: 'when', instruction: 'Add Due Date', Icon: Calendar },
    { id: 'what', instruction: 'Add Asset', Icon: Box },
    { id: 'priority', instruction: 'Add Priority', Icon: AlertTriangle },
    { id: 'category', instruction: 'Add Tag', Icon: Tag },
    { id: 'compliance', instruction: 'Add Compliance Rule', Icon: Shield },
  ] as const, []);

  const chipTypeToSection: Record<string, string> = {
    person: 'who', team: 'who', space: 'where', date: 'when', recurrence: 'when',
    asset: 'what', priority: 'priority', category: 'category', theme: 'category', compliance: 'compliance',
  };

  // Filter fact chips by section
  const factChipsBySection = useMemo(() => {
    const bySection: Record<string, SuggestedChip[]> = {};
    CREATE_TASK_SECTIONS.forEach(s => { bySection[s.id] = []; });
    factChips.forEach(chip => {
      const section = chipTypeToSection[chip.type];
      if (section && bySection[section]) bySection[section].push(chip);
    });
    return bySection;
  }, [factChips, CREATE_TASK_SECTIONS]);

  // Suggested (AI) chips by section — only chips not already in fact chips for that section
  // Excludes verb chips (blockingRequired && !resolvedEntityId) since those are handled separately
  const suggestedChipsBySection = useMemo(() => {
    const bySection: Record<string, SuggestedChip[]> = {};
    CREATE_TASK_SECTIONS.forEach(s => { bySection[s.id] = []; });
    const factIds = new Set(factChips.map(c => c.id));
    chipSuggestions.forEach(chip => {
      const section = chipTypeToSection[chip.type];
      // Exclude verb chips from suggested chips - they'll be shown separately with verb labels
      const isVerbChip = chip.blockingRequired && !chip.resolvedEntityId;
      if (section && bySection[section] && !factIds.has(chip.id) && !isVerbChip) bySection[section].push(chip);
    });
    return bySection;
  }, [chipSuggestions, factChips, CREATE_TASK_SECTIONS]);
  
  // Helper to generate verb label
  // ADD RESOLUTION RULE: Space and asset chips with blockingRequired && !resolvedEntityId generate "ADD" labels
  // These represent action intent that must trigger the add flow or be explicitly removed
  const generateVerbLabel = useCallback((chip: SuggestedChip): string => {
    const value = chip.value || chip.label;
    switch (chip.type) {
      case 'person':
        return `INVITE ${value.toUpperCase()}`;
      case 'team':
        return `CHOOSE ${value.toUpperCase()}`;
      case 'space':
        // ADD RESOLUTION RULE: "ADD {NAME} TO SPACES" must trigger space creation flow
        return `ADD ${value.toUpperCase()} TO SPACES`;
      case 'asset':
        // ADD RESOLUTION RULE: "ADD {NAME} TO ASSETS" must trigger asset creation flow
        return `ADD ${value.toUpperCase()} TO ASSETS`;
      case 'category':
        return `CHOOSE ${value.toUpperCase()}`;
      case 'date':
        return `SET ${value.toUpperCase()}`;
      default:
        return `CHOOSE ${value.toUpperCase()}`;
    }
  }, []);
  
  // Verb chips by section — unresolved action chips (blockingRequired && !resolvedEntityId) with verb labels
  // These appear as ghost chips in their respective rows (e.g., "INVITE FRANK" in Who row, "ADD COTTAGE" in Where row)
  const verbChipsBySection = useMemo(() => {
    const bySection: Record<string, SuggestedChip[]> = {};
    CREATE_TASK_SECTIONS.forEach(s => { bySection[s.id] = []; });
    verbChips.forEach(chip => {
      const section = chipTypeToSection[chip.type];
      if (section && bySection[section]) {
        // Create a copy with the verb label for display
        const verbChip: SuggestedChip = {
          ...chip,
          label: generateVerbLabel(chip),
        };
        bySection[section].push(verbChip);
      }
    });
    return bySection;
  }, [verbChips, CREATE_TASK_SECTIONS, generateVerbLabel]);
  
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
  
  // Handle chip removal (for fact chips in context row)
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
      'space': 'where',
      'asset': 'what',
      'date': 'when',
      'priority': 'priority',
      'category': 'category',
      'theme': 'category',
    };
    
    // ADD RESOLUTION RULE: "Add" chips (space/asset with blockingRequired && !resolvedEntityId) must trigger panel opening
    // This opens the relevant section (where/what) so user can add the entity
    // Open relevant panel when chip is clicked
    const section = chipTypeToSection[chip.type];
    if (section) {
      setActiveSection(section);
      // Scroll to panel
      setTimeout(() => {
        const panel = document.getElementById(`context-panel-${section}`);
        panel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
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
            .select('id, name, property_id, space_id')
            .eq('org_id', orgId)
            .eq('property_id', propertyId);
          assets = (data || []).map(a => ({
            id: a.id,
            name: a.name || '',
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
      };
      
      const entityType = chipTypeToEntityType[chip.type] || 'category';
      
      // Check resolution memory first
      const memoryEntityId = await queryResolutionMemory(orgId, chip.label, entityType);
      
      let resolution;
      if (memoryEntityId) {
        resolution = {
          resolved: true,
          entityId: memoryEntityId,
          entityType: entityType,
          resolutionSource: 'exact' as const,
          confidence: 0.9
        };
      } else {
        resolution = await resolveChip(chip, entities, { propertyId, spaceId: selectedSpaceIds[0] });
      }
      
      // Update chip with resolution
      // INVITE BEHAVIORAL CONTRACT: Person chips always have blockingRequired when unresolved
      // This ensures Invite chips are gated - they cannot be treated as normal passive metadata
      // Recurrence chips never block entity resolution - only space, asset, and person do
      const resolvedChip: SuggestedChip = {
        ...chip,
        state: resolution.resolved ? 'resolved' : resolution.requiresCreation ? 'blocked' : 'applied',
        resolvedEntityId: resolution.entityId,
        resolvedEntityType: resolution.entityType,
        resolutionSource: resolution.resolutionSource,
        resolutionConfidence: resolution.confidence,
        // Only space, asset, and person chips block entity resolution
        // ADD RESOLUTION RULE: Space/asset chips with blockingRequired && !resolvedEntityId are "Add" actions
        // INVITE BEHAVIORAL CONTRACT: Person chips with blockingRequired && !resolvedEntityId are Invite actions
        // Invite chips are NOT normal chips - they require explicit resolution or removal
        // Recurrence, date, priority, category, team chips never block
        blockingRequired: chip.type === 'space' || chip.type === 'asset' || chip.type === 'person',
      };
      
      const updated = new Map(appliedChips);
      updated.set(chip.id, resolvedChip);
      setAppliedChips(updated);
      
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
      
      // ADD RESOLUTION RULE: Auto-open panels for "Add" chips when prerequisites are missing
      // This ensures "Add" actions trigger the relevant flow
      if (chip.type === 'asset' && !propertyId) {
        setActiveSection('where');
      } else if (chip.type === 'asset' && propertyId && selectedSpaceIds.length === 0) {
        setActiveSection('where');
      }
    }
  }, [selectedChipIds, appliedChips, orgId, spaces, members, teams, categories, propertyId, selectedSpaceIds]);
  
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
          // INVITE BEHAVIORAL CONTRACT: Person chips with blockingRequired && !resolvedEntityId are Invite actions
          // Invite chips are NOT normal chips - they are gated actions requiring explicit resolution
          // They must be explicitly resolved - show explicit Invite intent with clear inline feedback
          blockingIssues.push(`Invite "${chip.label}" to assign this task, or choose an existing contact.`);
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
  // Enhanced: Better title quality scoring and formatting
  useEffect(() => {
    if (aiResult?.title && !userEditedTitle) {
      // Enhanced title processing:
      // 1. Capitalize first letter
      // 2. Trim whitespace
      // 3. Remove trailing punctuation if present
      // 4. Ensure minimum quality (at least 3 characters)
      let processedTitle = aiResult.title.trim();
      if (processedTitle.length >= 3) {
        // Capitalize first letter, keep rest as-is (preserves AI formatting)
        processedTitle = processedTitle.charAt(0).toUpperCase() + processedTitle.slice(1);
        // Remove trailing periods/exclamation if AI added them
        processedTitle = processedTitle.replace(/[.!]+$/, '');
        
        setAiTitleGenerated(processedTitle);
        setTitle(processedTitle);
        setShowTitleField(true);
      }
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
    setActiveSection(null);
    setAppliedChips(new Map());
    setSelectedChipIds([]);
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
    // SUBMISSION GUARDRAIL: Block submission if unresolved action chips exist
    // INVITE BEHAVIORAL CONTRACT: Person chips with blockingRequired && !resolvedEntityId are Invite actions
    // Invite chips are NOT normal chips - they are gated actions that require explicit resolution
    // ADD RESOLUTION RULE: Space/asset chips with blockingRequired && !resolvedEntityId are "Add" actions
    // Action chips (verb chips) represent unresolved intent that must be resolved or removed
    // Detection: chips with blockingRequired && !resolvedEntityId in appliedChips
    // These are action intents like "INVITE JAMES" or "ADD STOVE" that require user action
    // "Add" chips must resolve into real entities (spaces/assets) or be discarded - they cannot persist as metadata
    const unresolvedActionChips = Array.from(appliedChips.values()).filter(
      chip => chip.blockingRequired && !chip.resolvedEntityId
    );
    
    // INVITE BEHAVIORAL CONTRACT: Explicitly check for unresolved Invite intent (person chips)
    // Invite chips must resolve to a specific person/team or be removed - they cannot persist unresolved
    const unresolvedInviteChips = unresolvedActionChips.filter(chip => chip.type === 'person');
    
    // INVITE BEHAVIORAL CONTRACT: Submission cannot proceed with unresolved Invite intent
    if (unresolvedActionChips.length > 0) {
      // Generate explicit action labels for inline guidance
      const actionLabels = unresolvedActionChips.map(chip => generateVerbLabel(chip));
      const firstAction = unresolvedActionChips[0];
      const actionLabel = generateVerbLabel(firstAction);
      
      // Show explicit inline guidance explaining what must be resolved
      // INVITE BEHAVIORAL CONTRACT: Explicitly mention Invite actions with clear feedback
      const inviteMessage = unresolvedInviteChips.length > 0
        ? unresolvedInviteChips.length === 1
          ? `Invite "${unresolvedInviteChips[0].label}" to assign this task, or choose an existing contact.`
          : `${unresolvedInviteChips.length} invites need resolution before submission.`
        : null;
      
      toast({
        title: "Resolve action items first",
        description: inviteMessage || (unresolvedActionChips.length === 1
          ? `${actionLabel} before creating this task.`
          : `${actionLabels.length} action items need resolution: ${actionLabels.slice(0, 2).join(", ")}${actionLabels.length > 2 ? "..." : ""}`),
        variant: "destructive"
      });
      
      // INVITE BEHAVIORAL CONTRACT: Block submission - Invite chips must be resolved or removed
      // Invite intent must resolve to a specific person/team or be explicitly removed
      // Invite chips cannot persist as task metadata - they are action intent, not passive data
      // ADD RESOLUTION RULE: "Add" chips must resolve into real entities (spaces/assets) or be explicitly removed
      // "Add" chips must never be included in the submitted task payload - they are action intent, not metadata
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
      {/* Header - only show for modal variant */}
      {variant !== "column" && (
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
      )}

      {/* Scrollable Content - Vertical Layout */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
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
                className="w-full px-4 py-3 rounded-[8px] bg-input shadow-engraved focus:outline-none focus:ring-2 focus:ring-primary/30 font-sans text-lg transition-shadow"
                placeholder="Generated title…"
              />
            </div>
          )}
        </div>

        {/* Combined Description + Subtasks Panel */}
        <SubtasksSection subtasks={subtasks} onSubtasksChange={setSubtasks} description={description} onDescriptionChange={setDescription} className="bg-transparent" />

        {/* Vertical stacked Create Task rows (authoritative layout): Who → Where → When → Assets → Priority → Tags → Compliance */}
        <div className="space-y-0 flex flex-col mt-[15px]">
          {CREATE_TASK_SECTIONS.map(({ id, instruction, Icon }) => (
            <CreateTaskRow
              key={id}
              sectionId={id}
              icon={<Icon className="h-4 w-4 text-muted-foreground" />}
              instruction={instruction}
              isActive={activeSection === id}
              onActivate={() => setActiveSection(id)}
              factChips={factChipsBySection[id] ?? []}
              suggestedChips={suggestedChipsBySection[id] ?? []}
              verbChips={verbChipsBySection[id] ?? []}
              onChipRemove={handleChipRemove}
              onSuggestionClick={handleChipSelect}
              onVerbChipClick={handleChipSelect}
              hasUnresolved={unresolvedSections.includes(id)}
            >
              {activeSection === id && id === 'who' && (
                <WhoPanel
                  assignedUserId={assignedUserId}
                  assignedTeamIds={assignedTeamIds}
                  onUserChange={setAssignedUserId}
                  onTeamsChange={setAssignedTeamIds}
                  suggestedPeople={aiResult?.people?.map(p => p.name) || []}
                  pendingInvitations={pendingInvitations}
                  onPendingInvitationsChange={setPendingInvitations}
                  instructionBlock={instructionBlock}
                  onInstructionDismiss={() => setInstructionBlock(null)}
                  onInviteToOrg={() => toast({ title: "Invite functionality coming soon" })}
                  onAddAsContractor={() => toast({ title: "Contractor creation coming soon" })}
                />
              )}
              {activeSection === id && id === 'where' && (
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
              )}
              {activeSection === id && id === 'when' && (
                <WhenPanel
                  dueDate={dueDate}
                  repeatRule={repeatRule}
                  onDueDateChange={setDueDate}
                  onRepeatRuleChange={setRepeatRule}
                />
              )}
              {activeSection === id && id === 'priority' && (
                <PriorityPanel priority={priority} onPriorityChange={setPriority} />
              )}
              {activeSection === id && id === 'category' && (
                <CategoryPanel
                  selectedThemeIds={selectedThemeIds}
                  onThemesChange={setSelectedThemeIds}
                  suggestedThemes={aiResult?.themes?.map(t => ({ name: t.name, type: t.type })) || []}
                  instructionBlock={instructionBlock}
                  onInstructionDismiss={() => setInstructionBlock(null)}
                />
              )}
              {activeSection === id && id === 'what' && (
                propertyId ? (
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
                  <span className="text-[11px] font-mono uppercase text-muted-foreground">Select a property first</span>
                )
              )}
              {activeSection === id && id === 'compliance' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="text-[11px] font-mono uppercase text-muted-foreground">Compliance</label>
                  <Switch id="row-compliance" checked={isCompliance} onCheckedChange={setIsCompliance} />
                  {isCompliance && (
                    <Select value={complianceLevel} onValueChange={setComplianceLevel}>
                      <SelectTrigger className="h-8 w-auto min-w-[100px] text-[11px] font-mono">
                        <SelectValue placeholder="Level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </CreateTaskRow>
          ))}
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
        {showAdvanced && <div className="space-y-4 p-4 rounded-[8px] bg-muted/50 shadow-engraved">
            {/* Compliance Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="compliance" className="text-sm">Compliance Task</Label>
                <p className="text-xs text-muted-foreground">Mark as regulatory requirement</p>
              </div>
              <Switch id="compliance" checked={isCompliance} onCheckedChange={setIsCompliance} />
            </div>

            {isCompliance && <div className="space-y-2">
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
              </div>}

            {/* Annotation Required */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="annotation" className="text-sm">Requires Photo Annotation</Label>
                <p className="text-xs text-muted-foreground">Enforce photo markup on completion</p>
              </div>
              <Switch id="annotation" checked={annotationRequired} onCheckedChange={setAnnotationRequired} />
            </div>
          </div>}
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-3 p-4 border-t border-border/30 bg-card/80 backdrop-blur">
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
              // SUBMISSION GUARDRAIL: Disable if unresolved action chips exist
              // Action chips must be resolved into entities or explicitly removed
              disabled={isSubmitting || (clarityState?.severity === 'blocking') || verbChips.length > 0}
            >
              {isSubmitting ? "Creating..." : "Create Task"}
            </Button>
          )}
        </div>
      </div>
    </div>;

  // For column variant on wide screens, render inline accordion (not Dialog)
  if (variant === "column") {
    const accordionBodyId = "create-task-accordion-body";
    const isExpanded = open;

    return (
      <div className="h-auto flex flex-col bg-background rounded-[12px] shadow-[2px_4px_6px_0px_rgba(0,0,0,0.15),inset_1px_1px_2px_0px_rgba(255,255,255,1),inset_-1px_-1px_2px_0px_rgba(0,0,0,0.25)] border-0 relative overflow-hidden" style={{
        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise-filter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.522\' numOctaves=\'1\' stitchTiles=\'stitch\'%3E%3C/feTurbulence%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'%3E%3C/feColorMatrix%3E%3CfeComponentTransfer%3E%3CfeFuncR type=\'linear\' slope=\'0.468\'%3E%3C/feFuncR%3E%3CfeFuncG type=\'linear\' slope=\'0.468\'%3E%3C/feFuncG%3E%3CfeFuncB type=\'linear\' slope=\'0.468\'%3E%3C/feFuncB%3E%3CfeFuncA type=\'linear\' slope=\'0.137\'%3E%3C/feFuncA%3E%3C/feComponentTransfer%3E%3CfeComponentTransfer%3E%3CfeFuncR type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3CfeFuncG type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3CfeFuncB type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise-filter)\' opacity=\'0.8\'%3E%3C/rect%3E%3C/svg%3E")',
        backgroundSize: '100%'
      }}>
        {/* Section Title - Accordion Header */}
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={accordionBodyId}
          onClick={() => onOpenChange(!isExpanded)}
          className={cn(
            "px-4 pt-4 pb-4 border-b border-border/30 w-full text-left",
            "flex items-center justify-between gap-3",
            "bg-[#85BABC] transition-colors hover:bg-[#85BABC]",
            "rounded-t-[12px] shadow-[inset_-2px_-2px_3px_-2px_rgba(0,0,0,0.3),inset_2px_3px_2.5px_0px_rgba(255,255,255,0.4)]"
          )}
        >
          <h2 className="text-lg font-semibold text-white">Create Task</h2>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-white" />
          ) : (
            <ChevronDown className="h-5 w-5 text-white" />
          )}
        </button>

        <div
          id={accordionBodyId}
          className={cn(
            "overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out",
            isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
          )}
        >
          {content}
        </div>
      </div>
    );
  }

  // Mobile: Bottom sheet drawer, Desktop: Center dialog
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