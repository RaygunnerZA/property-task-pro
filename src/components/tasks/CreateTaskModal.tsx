import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { X, Plus, ChevronDown, ChevronUp, User, Calendar, MapPin, AlertTriangle, ListTodo, Shield, Check } from "lucide-react";
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
import { PerforationLine } from "./create/PerforationLine";
import { ClarityState, ClaritySeverity } from "./create/ClarityState";
import { FillaIcon } from "@/components/filla/FillaIcon";
import { useChipSuggestions } from "@/hooks/useChipSuggestions";
import { resolveChip, type AvailableEntities } from "@/services/ai/resolutionPipeline";
import type { EntityType } from "@/types/chip-suggestions";
import { queryResolutionMemory, storeResolutionMemory } from "@/services/ai/resolutionMemory";
import { logChipResolution } from "@/services/ai/resolutionAudit";
import type { SuggestedChip } from "@/types/chip-suggestions";

// Section Components
import { SubtasksSection, type SubtaskInput } from "./create/SubtasksSection";
import { ImageUploadSection } from "./create/ImageUploadSection";
import { ThemesSection } from "./create/ThemesSection";
import { AssetsSection } from "./create/AssetsSection";
import { TaskMetadataIconRow } from "./create/TaskMetadataIconRow";
import type { CreateTaskPayload, TaskPriority, RepeatRule, CreateTaskImagePayload } from "@/types/database";
interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated?: (taskId: string) => void;
  defaultPropertyId?: string;
  defaultDueDate?: string;
}
export function CreateTaskModal({
  open,
  onOpenChange,
  onTaskCreated,
  defaultPropertyId,
  defaultDueDate
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
  const [images, setImages] = useState<CreateTaskImagePayload[]>([]);
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
  
  // Clarity state
  const [clarityState, setClarityState] = useState<{
    severity: ClaritySeverity;
    message: string;
  } | null>(null);
  
  // Get teams and categories for resolution
  const { teams } = useTeams();
  const { categories } = useCategories();
  
  // Handle chip selection and resolution
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
      const resolvedChip: SuggestedChip = {
        ...chip,
        state: resolution.resolved ? 'resolved' : resolution.requiresCreation ? 'blocked' : 'applied',
        resolvedEntityId: resolution.entityId,
        resolvedEntityType: resolution.entityType,
        resolutionSource: resolution.resolutionSource,
        resolutionConfidence: resolution.confidence,
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
      
      // Handle auto-open panels for assets
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
          blockingIssues.push(`Asset "${chip.label}" requires a property to be selected.`);
        } else if (chip.type === 'person') {
          blockingIssues.push(`Filla couldn't find "${chip.label}". Choose an existing contact or invite someone new.`);
        } else {
          blockingIssues.push(`"${chip.label}" needs to be resolved before creating the task.`);
        }
      }
    });
    
    // Check property requirement for spaces/assets
    const hasSpaceOrAssetChips = Array.from(appliedChips.values()).some(
      c => (c.type === 'space' || c.type === 'asset') && !c.resolvedEntityId
    );
    if (hasSpaceOrAssetChips && !propertyId) {
      blockingIssues.push('A property must be selected when spaces or assets are suggested.');
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
  
  // #region agent log
  // Debug AI extraction flow
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateTaskModal.tsx:115',message:'AI extraction state',data:{description,descriptionLength:description.length,hasAiResult:!!aiResult,aiResultTitle:aiResult?.title,aiResultPriority:aiResult?.priority,aiResultDate:aiResult?.date,aiLoading,aiError,orgId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  }, [description, aiResult, aiLoading, aiError, orgId]);
  // #endregion

  // Auto-update title from AI when user hasn't manually edited
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateTaskModal.tsx:125',message:'Title auto-fill useEffect triggered',data:{hasAiResultTitle:!!aiResult?.title,aiResultTitle:aiResult?.title,userEditedTitle,willApply:!!(aiResult?.title && !userEditedTitle),currentTitle:title,showTitleField},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    if (aiResult?.title && !userEditedTitle) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateTaskModal.tsx:127',message:'Applying AI title to form',data:{aiTitle:aiResult.title,previousTitle:title,previousShowTitleField:showTitleField},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      setAiTitleGenerated(aiResult.title);
      setTitle(aiResult.title);
      setShowTitleField(true);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateTaskModal.tsx:132',message:'After setting title state',data:{setTitleCalled:true,setShowTitleFieldCalled:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
    }
  }, [aiResult?.title, userEditedTitle]);

  // Auto-apply AI suggestions when received
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateTaskModal.tsx:134',message:'AI suggestions useEffect triggered',data:{hasAiResult:!!aiResult,aiPriority:aiResult?.priority,currentPriority:priority},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    if (!aiResult) return;
    
    // Auto-set priority from AI
    if (aiResult.priority === "HIGH" || aiResult.priority === "high") {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateTaskModal.tsx:140',message:'Setting priority to high',data:{previousPriority:priority},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      setPriority("high");
    } else if (aiResult.priority === "URGENT" || aiResult.priority === "urgent") {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateTaskModal.tsx:142',message:'Setting priority to urgent',data:{previousPriority:priority},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      setPriority("urgent");
    } else if (aiResult.priority === "MEDIUM" || aiResult.priority === "medium") {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateTaskModal.tsx:144',message:'Setting priority to medium',data:{previousPriority:priority},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      setPriority("medium");
    } else if (aiResult.priority === "LOW" || aiResult.priority === "low") {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateTaskModal.tsx:146',message:'Setting priority to low',data:{previousPriority:priority},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
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

  // Apply all AI suggestions at once
  const handleApplyAllSuggestions = useCallback(() => {
    if (!aiResult) return;

    // Apply people
    if (aiResult.people && aiResult.people.length > 0) {
      const firstPerson = aiResult.people[0];
      const foundMember = members.find(
        (m) => m.display_name.toLowerCase() === firstPerson.name.toLowerCase()
      );
      if (foundMember) {
        setAssignedUserId(foundMember.user_id);
      } else {
        const [firstName, ...lastNameParts] = firstPerson.name.split(" ");
        const lastName = lastNameParts.join(" ") || "";
        const pendingInvitation: PendingInvitation = {
          id: `pending-${Date.now()}`,
          firstName,
          lastName,
          email: "",
          displayName: firstPerson.name,
        };
        setPendingInvitations([...pendingInvitations, pendingInvitation]);
        setAssignedUserId(`pending-${firstPerson.name}`);
      }
    }

    // Apply spaces
    if (aiResult.spaces && aiResult.spaces.length > 0) {
      aiResult.spaces.forEach((space) => {
        const foundSpace = spaces.find(
          (s) => s.name.toLowerCase() === space.name.toLowerCase()
        );
        if (foundSpace && !selectedSpaceIds.includes(foundSpace.id)) {
          setSelectedSpaceIds((prev) => [...prev, foundSpace.id]);
        } else if (!foundSpace) {
          const ghostId = `ghost-space-${space.name}`;
          if (!selectedSpaceIds.includes(ghostId)) {
            setSelectedSpaceIds((prev) => [...prev, ghostId]);
          }
        }
      });
    }

    // Apply date
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
        const targetDay = weekdays.indexOf(aiResult.date.toLowerCase());
        const currentDay = today.getDay();
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7;
        today.setDate(today.getDate() + daysToAdd);
        setDueDate(today.toISOString().split("T")[0]);
      } else {
        try {
          const date = new Date(aiResult.date);
          if (!isNaN(date.getTime())) {
            setDueDate(date.toISOString().split("T")[0]);
          }
        } catch {
          // Invalid date format
        }
      }
    }

    // Apply priority
    if (aiResult.priority) {
      const priorityLower = aiResult.priority.toLowerCase();
      if (priorityLower === "urgent" || priorityLower === "high" || priorityLower === "medium" || priorityLower === "low") {
        setPriority(priorityLower as TaskPriority);
      }
    }

    // Apply assets
    if (aiResult.assets && aiResult.assets.length > 0) {
      // Assets will be handled by the AssetsSection when expanded
      // For now, just track that we have asset suggestions
    }

    // Apply themes/categories
    if (aiResult.themes && aiResult.themes.length > 0) {
      // Themes will be handled by the ThemesSection when expanded
      // For now, just track that we have theme suggestions
    }

    toast({
      title: "AI suggestions applied",
      description: "All available suggestions have been applied to your task.",
    });
  }, [aiResult, members, spaces, selectedSpaceIds, pendingInvitations, toast]);
  const handleSubmit = async () => {
    // Validation: Check resolution truth (Final Pre-Build Rule)
    const blockingChips = Array.from(appliedChips.values()).filter(
      chip => chip.blockingRequired && !chip.resolvedEntityId
    );
    
    if (blockingChips.length > 0) {
      const firstBlocking = blockingChips[0];
      toast({
        title: "Resolve before creating",
        description: `"${firstBlocking.label}" needs to be resolved before creating the task.`,
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
        title: "Property required",
        description: "A property must be selected when spaces or assets are applied.",
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
        title: "Description required",
        description: "Please enter a task title or description.",
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
        title: "Not authenticated",
        description: "Please log in to create tasks.",
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
          throw new Error(`Cannot create space "${spaceName}" without a property selected`);
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
          throw new Error(`Failed to create space "${spaceName}": ${spaceError.message}`);
        }
        
        if (!newSpace) {
          throw new Error(`Failed to create space "${spaceName}": no data returned`);
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
          throw new Error(`Failed to create theme "${themeName}": ${themeError.message}`);
        }
        
        if (!newTheme) {
          throw new Error(`Failed to create theme "${themeName}": no data returned`);
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
        throw new Error("Failed to create task: no data returned");
      }

      const taskId = newTask.id;
      console.log('[CreateTaskModal] Task created successfully:', { taskId, newTask });
      
      // Upload images to storage and create task_images records
      if (images.length > 0 && taskId && orgId) {
        for (const image of images) {
          try {
            // Convert data URL to File
            const response = await fetch(image.image_url);
            const blob = await response.blob();
            const file = new File([blob], image.original_filename || 'image.jpg', { type: image.file_type || 'image/jpeg' });
            
            // Upload to storage
            const fileExt = file.name.split('.').pop() || 'jpg';
            const fileName = `org/${orgId}/tasks/${taskId}/${crypto.randomUUID()}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
              .from("task-images")
              .upload(fileName, file, {
                cacheControl: "3600",
                upsert: false,
              });

            if (uploadError) {
              console.error("Image upload error:", uploadError);
              // Show user-friendly error message
              toast({
                title: "Image upload failed",
                description: uploadError.message.includes("maximum allowed size")
                  ? `Image "${image.original_filename}" is too large. Please use a smaller image.`
                  : `Failed to upload "${image.original_filename}": ${uploadError.message}`,
                variant: "destructive",
              });
              continue;
            }

            // Get public URL
            const { data: urlData } = supabase.storage
              .from("task-images")
              .getPublicUrl(fileName);

            // Create attachment record (using attachments table per @Docs/14_Attachments.md)
            const attachmentPayload = {
              org_id: orgId,
              parent_type: "task",
              parent_id: taskId,
              file_url: urlData.publicUrl,
              file_name: image.original_filename,
              file_type: image.file_type || file.type,
              file_size: file.size,
            };
            
            const { data: insertedAttachment, error: imageRecordError } = await supabase
              .from("attachments")
              .insert(attachmentPayload)
              .select()
              .single();

            if (imageRecordError) {
              console.error("Error creating attachment record:", imageRecordError);
              toast({
                title: "Failed to save image",
                description: imageRecordError.message.includes("row-level security")
                  ? "You don't have permission to upload images. Please contact your administrator."
                  : `Failed to save "${image.original_filename}": ${imageRecordError.message}`,
                variant: "destructive",
              });
              continue;
            }
            
            if (!insertedAttachment) {
              console.error("Attachment record created but no data returned");
              toast({
                title: "Image upload incomplete",
                description: `Image "${image.original_filename}" was uploaded but could not be linked to the task.`,
                variant: "destructive",
              });
              continue;
            }
            
            console.log('[CreateTaskModal] Attachment created successfully:', {
              attachmentId: insertedAttachment.id,
              taskId,
              fileName: image.original_filename,
            });
          } catch (err: any) {
            console.error("Error uploading image:", err);
            toast({
              title: "Image upload failed",
              description: err.message || `Failed to upload "${image.original_filename}"`,
              variant: "destructive",
            });
          }
        }
        
        // Invalidate queries immediately after images are uploaded
        // This ensures the task list updates even before thumbnails are processed
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
        queryClient.invalidateQueries({ queryKey: ["task-details", orgId, taskId] });
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
        title: "Error creating task",
        description: error.message || "Something went wrong.",
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
          <Plus className="h-5 w-5 text-primary" />
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
        <ImageUploadSection images={images} onImagesChange={setImages} />

        {/* AI-Generated Title (appears after AI responds) */}
        <div className={cn(
          "transition-all duration-300 ease-out mt-[6px]",
          showTitleField ? "opacity-100 max-h-24" : "opacity-0 max-h-0 overflow-hidden"
        )}>
          {(() => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/8c0e792f-62c4-49ed-ac4e-5af5ac66d2ea',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateTaskModal.tsx:712',message:'Rendering title field',data:{showTitleField,title,aiTitleGenerated,userEditedTitle},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
            // #endregion
            return null;
          })()}
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
                className="w-full px-4 py-3 rounded-xl bg-card shadow-e1 focus:shadow-e2 focus:outline-none focus:ring-2 focus:ring-primary/30 font-sans text-lg transition-shadow"
                placeholder="Generated title…"
              />
            </div>
          )}
        </div>

        {/* Combined Description + Subtasks Panel */}
        <SubtasksSection subtasks={subtasks} onSubtasksChange={setSubtasks} description={description} onDescriptionChange={setDescription} className="bg-transparent" />

        {/* Icon Row - Opens Context Panels Below */}
        <TaskMetadataIconRow
          aiResult={aiResult}
          activeSection={activeSection}
          onSectionClick={(section) => {
            setActiveSection(section);
            // Scroll to panel if section is selected
            if (section) {
              setTimeout(() => {
                const panel = document.getElementById(`context-panel-${section}`);
                panel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }, 100);
            }
          }}
          onApplyAllSuggestions={handleApplyAllSuggestions}
          appliedPeople={assignedUserId ? [members.find(m => m.user_id === assignedUserId)?.display_name || ""].filter(Boolean) : []}
          appliedSpaces={selectedSpaceIds.map(id => {
            if (id.startsWith("ghost-space-")) {
              return id.replace("ghost-space-", "");
            }
            return spaces.find(s => s.id === id)?.name || "";
          }).filter(Boolean)}
          appliedDate={dueDate}
          appliedAssets={selectedAssetIds}
          appliedPriority={priority}
          appliedThemes={selectedThemeIds}
        />

        {/* Perforation Line - Below AI Suggestion Section */}
        {aiResult && (
          (aiResult.people?.length ?? 0) > 0 ||
          (aiResult.spaces?.length ?? 0) > 0 ||
          aiResult.date ||
          (aiResult.assets?.length ?? 0) > 0 ||
          aiResult.priority ||
          (aiResult.themes?.length ?? 0) > 0
        ) ? <PerforationLine /> : null}

        {/* Context Panels - Only Visible When Active Section is Selected */}
        {activeSection && (
          <div className="space-y-6">
            {/* Who Panel */}
            {activeSection === 'who' && (
              <div id="context-panel-who">
                <WhoPanel 
                  assignedUserId={assignedUserId} 
                  assignedTeamIds={assignedTeamIds} 
                  onUserChange={setAssignedUserId} 
                  onTeamsChange={setAssignedTeamIds}
                  suggestedPeople={aiResult?.people?.map(p => p.name) || []}
                  pendingInvitations={pendingInvitations}
                  onPendingInvitationsChange={setPendingInvitations}
                />
              </div>
            )}

            {/* Where Panel */}
            {activeSection === 'where' && (
              <div id="context-panel-where">
                <WherePanel 
                  propertyId={propertyId} 
                  spaceIds={selectedSpaceIds} 
                  onPropertyChange={handlePropertyChange} 
                  onSpacesChange={setSelectedSpaceIds}
                  suggestedSpaces={aiResult?.spaces?.map(s => s.name) || []}
                  defaultPropertyId={defaultPropertyId}
                />
              </div>
            )}

            {/* When Panel */}
            {activeSection === 'when' && (
              <div id="context-panel-when">
                <WhenPanel 
                  dueDate={dueDate} 
                  repeatRule={repeatRule} 
                  onDueDateChange={setDueDate} 
                  onRepeatRuleChange={setRepeatRule} 
                />
              </div>
            )}

            {/* Priority Panel */}
            {activeSection === 'priority' && (
              <div id="context-panel-priority">
                <PriorityPanel 
                  priority={priority} 
                  onPriorityChange={setPriority} 
                />
              </div>
            )}

            {/* Category Panel */}
            {activeSection === 'category' && (
              <div id="context-panel-category">
                <CategoryPanel 
                  selectedThemeIds={selectedThemeIds} 
                  onThemesChange={setSelectedThemeIds}
                  suggestedThemes={aiResult?.themes?.map(t => ({ name: t.name, type: t.type })) || []}
                />
              </div>
            )}

            {/* Asset Panel - Only show if property is selected */}
            {activeSection === 'what' && propertyId && (
              <div id="context-panel-what">
                <AssetPanel
                  propertyId={propertyId}
                  spaceId={selectedSpaceIds[0]}
                  selectedAssetIds={selectedAssetIds}
                  onAssetsChange={setSelectedAssetIds}
                  suggestedAssets={aiResult?.assets || []}
                />
              </div>
            )}
          </div>
        )}


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

        {/* Advanced Options Toggle */}
        <button type="button" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full" onClick={() => setShowAdvanced(!showAdvanced)}>
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <Shield className="h-4 w-4" />
          Compliance & Advanced
        </button>

        {/* Advanced Options */}
        {showAdvanced && <div className="space-y-4 p-4 rounded-xl bg-muted/50 shadow-engraved">
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
              disabled={isSubmitting || (clarityState?.severity === 'blocking')}
            >
              {isSubmitting ? "Creating..." : "Create Task"}
            </Button>
          )}
        </div>
      </div>
    </div>;

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