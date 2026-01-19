import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { X, Plus, ChevronDown, ChevronUp, User, Calendar, MapPin, AlertTriangle, ListTodo, Shield, Check, Box, Tag } from "lucide-react";
import { useAIExtract } from "@/hooks/useAIExtract";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { useThemes } from "@/hooks/useThemes";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { DashboardCalendar } from "@/components/dashboard/DashboardCalendar";
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
import { UnifiedTaskSection } from "./create/UnifiedTaskSection";
import type { CreateTaskPayload, TaskPriority, RepeatRule } from "@/types/database";
import type { TempImage } from "@/types/temp-image";
import { cleanupTempImage } from "@/utils/image-optimization";
import { useTaskDraft } from "@/hooks/useTaskDraft";
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
  const {
    templates
  } = useChecklistTemplates();
  const { lastUsedPropertyId, setLastUsed } = useLastUsedProperty();
  const { members } = useOrgMembers();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { draft, saveDraft, clearDraft } = useTaskDraft();

  // Form state
  const [title, setTitle] = useState("");
  const [descriptionState, setDescriptionStateRaw] = useState("");
  
  // #region agent log
  // Track description changes to debug render loop
  const descriptionRef = useRef(descriptionState);
  const descriptionChangeCountRef = useRef(0);
  const descriptionSetCountRef = useRef(0);
  const descriptionStateRef = useRef(descriptionState);
  
  // Keep ref in sync with state
  useEffect(() => {
    descriptionStateRef.current = descriptionState;
  }, [descriptionState]);
  
  // Memoize setDescription WITHOUT depending on descriptionState (use ref instead)
  // This prevents the callback from being recreated on every change, which would
  // cause SubtasksSection to re-render and potentially trigger loops
  const setDescription = useCallback((value: string | ((prev: string) => string)) => {
    descriptionSetCountRef.current += 1;
    
    // #region agent log
    if (descriptionSetCountRef.current > 10 && descriptionSetCountRef.current % 5 === 0) {
      const stack = new Error().stack;
      const caller = stack?.split('\n')[2]?.trim() || 'unknown';
      console.warn('[CreateTaskModal] setDescription called:', {
        callCount: descriptionSetCountRef.current,
        caller: caller.substring(0, 100),
        valueType: typeof value,
        valueLength: typeof value === 'string' ? value.length : 'function',
        currentLength: descriptionStateRef.current.length,
        valuePreview: typeof value === 'string' ? value.substring(0, 30) : 'function',
      });
    }
    // #endregion
    
    // If it's a function, we need to check with current state
    if (typeof value === 'function') {
      const newValue = value(descriptionStateRef.current);
      // Only update if actually different
      if (newValue !== descriptionStateRef.current) {
        setDescriptionStateRaw(newValue);
      }
      return;
    }
    
    // If it's a string, only update if it's actually different (use ref to avoid dependency)
    if (value !== descriptionStateRef.current) {
      // #region agent log
      if (descriptionSetCountRef.current > 5) {
        console.log('[CreateTaskModal] Description value changed:', {
          prevLength: descriptionStateRef.current.length,
          newLength: value.length,
          prevValue: descriptionStateRef.current.substring(0, 50),
          newValue: value.substring(0, 50),
        });
      }
      // #endregion
      setDescriptionStateRaw(value);
    } else {
      // #region agent log
      if (descriptionSetCountRef.current > 10) {
        console.log('[CreateTaskModal] setDescription called with same value, skipping update');
      }
      // #endregion
    }
  }, []); // NO DEPENDENCIES - stable callback reference
  
  // Memoize description to prevent new string references on every render
  const description = useMemo(() => descriptionState, [descriptionState]);
  
  if (description !== descriptionRef.current) {
    descriptionChangeCountRef.current += 1;
    if (descriptionChangeCountRef.current > 20 && descriptionChangeCountRef.current % 10 === 0) {
      console.error('[CreateTaskModal] DESCRIPTION VALUE CHANGING:', {
        changeCount: descriptionChangeCountRef.current,
        prevLength: descriptionRef.current?.length || 0,
        newLength: description?.length || 0,
      });
    }
    descriptionRef.current = description;
  }
  // #endregion
  
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
  const [subtasksRaw, setSubtasksRaw] = useState<SubtaskInput[]>([]);
  const subtasksRef = useRef<SubtaskInput[]>([]);
  
  // Keep ref in sync with state
  useEffect(() => {
    subtasksRef.current = subtasksRaw;
  }, [subtasksRaw]);
  
  // Memoize subtasks array to prevent unnecessary re-renders
  const subtasks = useMemo(() => subtasksRaw, [subtasksRaw]);
  
  // Memoize setSubtasks WITHOUT depending on subtasksRaw (use ref instead)
  // This prevents the callback from being recreated on every change
  const setSubtasks = useCallback((value: SubtaskInput[] | ((prev: SubtaskInput[]) => SubtaskInput[])) => {
    if (typeof value === 'function') {
      setSubtasksRaw(value(subtasksRef.current));
    } else {
      // Only update if array reference or content actually changed (use ref)
      const prevIds = subtasksRef.current.map(s => s.id).join(',');
      const newIds = value.map(s => s.id).join(',');
      if (prevIds !== newIds || subtasksRef.current.length !== value.length) {
        setSubtasksRaw(value);
      }
    }
  }, []); // NO DEPENDENCIES - stable callback reference
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [images, setImages] = useState<TempImage[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>('where'); // Replaces activeTab

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
      'asset': 'assets',
      'category': 'category',
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
  
  // Get teams, categories/themes, and properties for resolution
  const { teams } = useTeams();
  const { categories } = useCategories();
  const { themes } = useThemes(); // All themes (categories, projects, tags, groups)
  const { data: properties = [] } = usePropertiesQuery();
  
  // Helper to get fact chips by section
  const getFactChipsBySection = useCallback((sectionId: string) => {
    const sectionChipTypes: Record<string, ChipType[]> = {
      'who': ['person', 'team'],
      'where': ['space'],
      'when': ['date', 'recurrence'],
      'assets': ['asset'],
      'priority': ['priority'],
      'category': ['category', 'theme'],
    };
    
    const types = sectionChipTypes[sectionId] || [];
    return factChips.filter(chip => types.includes(chip.type));
  }, [factChips]);

  // Helper to get active chips for WHO section
  const getWhoActiveChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove?: () => void }> = [];
    
    // User chip
    if (assignedUserId) {
      const member = members.find(m => m.user_id === assignedUserId);
      if (member) {
        chips.push({
          id: `user-${assignedUserId}`,
          label: member.display_name.toUpperCase(),
          onRemove: () => setAssignedUserId(undefined)
        });
      }
    }
    
    // Team chips
    assignedTeamIds.forEach(teamId => {
      const team = teams.find(t => t.id === teamId);
      if (team) {
        chips.push({
          id: `team-${teamId}`,
          label: (team.name || 'TEAM').toUpperCase(),
          onRemove: () => setAssignedTeamIds(assignedTeamIds.filter(id => id !== teamId))
        });
      }
    });
    
    // Add fact chips from AI (resolved)
    getFactChipsBySection('who').forEach(chip => {
      if (chip.resolvedEntityId) {
        if (chip.type === 'person') {
          const member = members.find(m => m.user_id === chip.resolvedEntityId);
          if (member && !chips.find(c => c.id === `user-${member.user_id}`)) {
            chips.push({
              id: `fact-user-${chip.id}`,
              label: member.display_name.toUpperCase(),
              onRemove: () => {
                const updated = new Map(appliedChips);
                updated.delete(chip.id);
                setAppliedChips(updated);
              }
            });
          }
        } else if (chip.type === 'team') {
          const team = teams.find(t => t.id === chip.resolvedEntityId);
          if (team && !chips.find(c => c.id === `team-${team.id}`)) {
            chips.push({
              id: `fact-team-${chip.id}`,
              label: (team.name || 'TEAM').toUpperCase(),
              onRemove: () => {
                const updated = new Map(appliedChips);
                updated.delete(chip.id);
                setAppliedChips(updated);
              }
            });
          }
        }
      }
    });
    
    return chips;
  }, [assignedUserId, assignedTeamIds, members, teams, getFactChipsBySection, appliedChips]);

  // Helper to get active chips for WHERE section
  const getWhereActiveChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove?: () => void }> = [];
    
    // Property chip (if selected)
    if (propertyId && selectedPropertyIds.length > 0) {
      const property = properties.find(p => p.id === propertyId);
      if (property) {
        // If spaces selected, show composite "Property · Space" chips
        if (selectedSpaceIds.length > 0) {
          selectedSpaceIds.forEach(spaceId => {
            const space = spaces.find(s => s.id === spaceId);
            if (space) {
              chips.push({
                id: `space-${spaceId}`,
                label: `${property.name || 'Property'} · ${space.name.toUpperCase()}`,
                onRemove: () => setSelectedSpaceIds(selectedSpaceIds.filter(id => id !== spaceId))
              });
            }
          });
        } else {
          chips.push({
            id: `property-${propertyId}`,
            label: (property.name || 'PROPERTY').toUpperCase(),
            onRemove: () => {
              setPropertyId("");
              setSelectedPropertyIds([]);
            }
          });
        }
      }
    }
    
    return chips;
  }, [propertyId, selectedPropertyIds, selectedSpaceIds, properties, spaces]);

  // Helper to get active chips for WHEN section
  const getWhenActiveChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove?: () => void }> = [];
    
    if (dueDate) {
      const date = new Date(dueDate);
      const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
      chips.push({
        id: 'due-date',
        label: weekday.toUpperCase(),
        onRemove: () => setDueDate("")
      });
    }
    
    if (repeatRule) {
      chips.push({
        id: 'repeat',
        label: `EVERY ${repeatRule.interval} ${repeatRule.type.toUpperCase()}`,
        onRemove: () => setRepeatRule(undefined)
      });
    }
    
    return chips;
  }, [dueDate, repeatRule]);

  // Helper to get active chips for PRIORITY section
  const getPriorityActiveChips = useMemo(() => {
    if (priority === 'medium') return [];
    return [{
      id: 'priority',
      label: priority.toUpperCase(),
      onRemove: () => setPriority('medium')
    }];
  }, [priority]);

  // Helper to get active chips for CATEGORY section
  const getCategoryActiveChips = useMemo(() => {
    return selectedThemeIds.map(themeId => {
      // Handle ghost themes
      if (themeId.startsWith('ghost-theme-')) {
        const match = themeId.match(/^ghost-theme-(.+?)-(.+)$/);
        if (match) {
          const [, themeName] = match;
          return {
            id: `theme-${themeId}`,
            label: themeName.toUpperCase(),
            onRemove: () => setSelectedThemeIds(selectedThemeIds.filter(id => id !== themeId))
          };
        }
      }
      // Get theme name
      const theme = themes.find(t => t.id === themeId);
      return {
        id: `theme-${themeId}`,
        label: (theme?.name || 'CATEGORY').toUpperCase(),
        onRemove: () => setSelectedThemeIds(selectedThemeIds.filter(id => id !== themeId))
      };
    });
  }, [selectedThemeIds, themes]);

  // Load assets for ASSETS section
  const [assets, setAssets] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    const loadAssets = async () => {
      if (!propertyId || !orgId) {
        setAssets([]);
        return;
      }
      
      try {
        // Use assets_view which has serial (not name) - assets table doesn't have name column
        let query = supabase
          .from('assets_view')
          .select('id, serial, property_id, space_id')
          .eq('org_id', orgId)
          .eq('property_id', propertyId);

        if (selectedSpaceIds.length > 0) {
          query = query.eq('space_id', selectedSpaceIds[0]);
        }

        const { data, error } = await query;
        if (error) throw error;
        // Map serial to name for compatibility
        setAssets((data || []).map(a => ({
          ...a,
          name: a.serial || ''
        })));
      } catch (err) {
        console.error('Error loading assets:', err);
        setAssets([]);
      }
    };
    
    loadAssets();
  }, [propertyId, selectedSpaceIds, orgId]);

  // Helper to get active chips for ASSETS section
  const getAssetsActiveChips = useMemo(() => {
    return selectedAssetIds.map(assetId => {
      const asset = assets.find(a => a.id === assetId);
      return {
        id: `asset-${assetId}`,
        label: (asset?.name || 'ASSET').toUpperCase(),
        onRemove: () => setSelectedAssetIds(selectedAssetIds.filter(id => id !== assetId))
      };
    });
  }, [selectedAssetIds, assets]);

  // Handle section toggle - only one expands at a time
  const handleSectionToggle = useCallback((sectionId: string) => {
    setActiveSection(activeSection === sectionId ? null : sectionId);
  }, [activeSection]);

  // Handle chip removal (for fact chips)
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
      'asset': 'assets',
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
          // Use assets_view which has serial (not name) - assets table doesn't have name column
          const { data } = await supabase
            .from('assets_view')
            .select('id, serial, property_id, space_id')
            .eq('org_id', orgId)
            .eq('property_id', propertyId);
          assets = (data || []).map(a => ({
            id: a.id,
            name: (a as any).serial || '', // Use serial field as name
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

  // Fix dependency for suggestion chips helpers
  const getWhoSuggestionChipsMemo = useMemo(() => {
    return chipSuggestions
      .filter(chip => chip.type === 'person' && chip.metadata?.isUnresolved && !chip.resolvedEntityId)
      .map(chip => ({
        id: chip.id,
        label: chip.label,
        onSelect: () => handleChipSelect(chip)
      }));
  }, [chipSuggestions, handleChipSelect]);

  const getAssetsSuggestionChipsMemo = useMemo(() => {
    return chipSuggestions
      .filter(chip => chip.type === 'asset' && chip.metadata?.isUnresolved && !chip.resolvedEntityId)
      .map(chip => ({
        id: chip.id,
        label: chip.label,
        onSelect: () => handleChipSelect(chip)
      }));
  }, [chipSuggestions, handleChipSelect]);
  
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
    setDescriptionStateRaw("");
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
    setSubtasksRaw([]);
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

  // Restore draft when modal opens
  const [draftRestored, setDraftRestored] = useState(false);
  useEffect(() => {
    // #region agent log
    console.log('[CreateTaskModal] Draft restoration check', {
      open,
      hasDraft: !!draft,
      draftRestored,
      draftSubtasksLength: draft?.subtasks?.length || 0,
    });
    // #endregion
    
    if (open && draft && !draftRestored) {
      setTitle(draft.title || "");
      // Only set if different to avoid unnecessary updates
      const draftDescription = draft.description || "";
      if (draftDescription !== descriptionState) {
        // #region agent log
        console.log('[CreateTaskModal] Restoring description from draft', {
          draftLength: draftDescription.length,
          currentLength: descriptionState.length,
        });
        // #endregion
        setDescriptionStateRaw(draftDescription);
      }
      setPropertyId(draft.propertyId || defaultPropertyId || "");
      setSelectedPropertyIds(draft.selectedPropertyIds || (defaultPropertyId ? [defaultPropertyId] : []));
      setSelectedSpaceIds(draft.selectedSpaceIds || []);
      setPriority((draft.priority as TaskPriority) || "medium");
      setDueDate(draft.dueDate || defaultDueDate || "");
      setRepeatRule(draft.repeatRule);
      setAssignedUserId(draft.assignedUserId);
      setAssignedTeamIds(draft.assignedTeamIds || []);
      setPendingInvitations(draft.pendingInvitations || []);
      setIsCompliance(draft.isCompliance || false);
      setComplianceLevel(draft.complianceLevel || "");
      setAnnotationRequired(draft.annotationRequired || false);
      setTemplateId(draft.templateId || "");
      // #region agent log
      console.log('[CreateTaskModal] Restoring subtasks from draft', {
        draftSubtasksLength: draft.subtasks?.length || 0,
        currentSubtasksLength: subtasks.length,
      });
      // #endregion
      setSubtasksRaw(draft.subtasks || []);
      setSelectedThemeIds(draft.selectedThemeIds || []);
      setSelectedAssetIds(draft.selectedAssetIds || []);
      setImages(draft.images || []);
      setShowAdvanced(draft.showAdvanced || false);
      setActiveSection(draft.activeSection);
      setAiTitleGenerated(draft.aiTitleGenerated || "");
      setUserEditedTitle(draft.userEditedTitle || false);
      setShowTitleField(draft.showTitleField || false);
      
      // Restore applied chips
      if (draft.appliedChips && draft.appliedChips.length > 0) {
        const chipMap = new Map<string, SuggestedChip>();
        draft.appliedChips.forEach((chip: any) => {
          chipMap.set(chip.id, chip);
        });
        setAppliedChips(chipMap);
      }
      setSelectedChipIds(draft.selectedChipIds || []);
      setDraftRestored(true);
    } else if (open && !draft && !draftRestored) {
      // Only reset if no draft exists
      resetForm();
      setDraftRestored(true);
    } else if (!open) {
      // Reset flag when modal closes
      setDraftRestored(false);
    }
  }, [open, draft, draftRestored, defaultPropertyId, defaultDueDate]);

  // Save draft when modal closes (if has content)
  const wasOpenRef = useRef(open);
  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;

    // Only persist/clear draft when transitioning from open -> closed.
    // This prevents wiping an existing draft when the column variant is mounted
    // in a collapsed state (open=false).
    if (wasOpen && !open) {
      // Check if form has content before saving
      const hasContent = 
        title.trim() ||
        description.trim() ||
        selectedPropertyIds.length > 0 ||
        dueDate ||
        assignedUserId ||
        assignedTeamIds.length > 0 ||
        subtasks.length > 0 ||
        selectedThemeIds.length > 0 ||
        selectedAssetIds.length > 0 ||
        images.length > 0;

      if (hasContent) {
        saveDraft({
          title,
          description,
          propertyId,
          selectedPropertyIds,
          selectedSpaceIds,
          priority,
          dueDate,
          repeatRule,
          assignedUserId,
          assignedTeamIds,
          pendingInvitations,
          isCompliance,
          complianceLevel,
          annotationRequired,
          templateId,
          subtasks,
          selectedThemeIds,
          selectedAssetIds,
          images,
          showAdvanced,
          activeSection,
          aiTitleGenerated,
          userEditedTitle,
          showTitleField,
          appliedChips: Array.from(appliedChips.values()),
          selectedChipIds,
        });
      } else {
        // Clear draft if form is empty
        clearDraft();
      }
    }
  }, [open, title, description, selectedPropertyIds, dueDate, assignedUserId, assignedTeamIds, subtasks, selectedThemeIds, selectedAssetIds, images, saveDraft, clearDraft]);

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
      // Clear draft on successful task creation
      clearDraft();
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
      {/* Header - hidden for column variant */}
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

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Image Upload Icons */}
        <ImageUploadSection images={images} onImagesChange={setImages} taskId={undefined} />

        {/* AI-Generated Title (appears after AI responds) */}
        <div className={cn(
          "transition-all duration-300 ease-out mt-0",
          showTitleField ? "opacity-100 max-h-24" : "opacity-0 max-h-0 overflow-hidden"
        )}>
          {showTitleField && (
            <div className="space-y-2 mt-[14px]">
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
                className="w-full px-4 py-2 rounded-lg bg-input shadow-engraved focus:outline-none focus:ring-2 focus:ring-primary/30 font-sans text-sm transition-shadow"
                placeholder="Generated title…"
              />
            </div>
          )}
        </div>

        {/* Combined Description + Subtasks Panel */}
        <SubtasksSection 
          subtasks={subtasks} 
          onSubtasksChange={setSubtasks} 
          description={description} 
          onDescriptionChange={setDescription} 
          className="bg-transparent"
        />

        {/* Unified Sections - Always visible, collapsed by default */}
        <div className="space-y-2">
          {/* WHO Section */}
          <UnifiedTaskSection
            id="who"
            icon={User}
            sectionName="Who"
            placeholder="Add person or team…"
            activeChips={getWhoActiveChips}
            suggestionChips={getWhoSuggestionChipsMemo}
            isExpanded={activeSection === 'who'}
            onToggle={() => handleSectionToggle('who')}
            dropdownItems={[
              // Matches - People
              ...members.map(m => ({
                id: `match-user-${m.user_id}`,
                label: m.display_name,
                type: 'match' as const,
                action: () => {
                  if (assignedUserId === m.user_id) {
                    setAssignedUserId(undefined);
                  } else {
                    setAssignedUserId(m.user_id);
                  }
                }
              })),
              // Matches - Teams
              ...teams.map(t => ({
                id: `match-team-${t.id}`,
                label: t.name || 'Unnamed Team',
                type: 'match' as const,
                action: () => {
                  if (assignedTeamIds.includes(t.id)) {
                    setAssignedTeamIds(assignedTeamIds.filter(id => id !== t.id));
                  } else {
                    setAssignedTeamIds([...assignedTeamIds, t.id]);
                  }
                }
              })),
              // Actions - Invite people from AI suggestions
              ...(aiResult?.people?.filter(p => 
                !members.some(m => m.display_name.toLowerCase() === p.name.toLowerCase())
              ).map(p => ({
                id: `action-invite-${p.name}`,
                label: `Invite "${p.name}"…`,
                type: 'action' as const,
                action: () => {
                  toast({ title: "Invite functionality coming soon" });
                }
              })) || []),
              // Actions - Create teams from AI suggestions
              ...(aiResult?.teams?.filter(t => 
                !teams.some(existingTeam => existingTeam.name?.toLowerCase() === t.name.toLowerCase())
              ).map(t => ({
                id: `action-create-team-${t.name}`,
                label: `Create team "${t.name}"…`,
                type: 'action' as const,
                action: () => {
                  toast({ title: "Team creation coming soon" });
                }
              })) || [])
            ]}
            onItemSelect={(item) => item.action?.()}
            blockingMessage={unresolvedSections.includes('who') ? "Resolve before creating." : undefined}
          />

          {/* WHERE Section */}
          <UnifiedTaskSection
            id="where"
            icon={MapPin}
            sectionName="Where"
            placeholder="Add property or space…"
            activeChips={getWhereActiveChips}
            isExpanded={activeSection === 'where'}
            onToggle={() => handleSectionToggle('where')}
            dropdownItems={[
              // Matches - Properties
              ...properties.map(p => ({
                id: `match-property-${p.id}`,
                label: p.name || 'Unnamed Property',
                type: 'match' as const,
                action: () => {
                  if (selectedPropertyIds.includes(p.id)) {
                    setSelectedPropertyIds(selectedPropertyIds.filter(id => id !== p.id));
                    if (propertyId === p.id) {
                      setPropertyId("");
                    }
                  } else {
                    setSelectedPropertyIds([...selectedPropertyIds, p.id]);
                    if (!propertyId) {
                      setPropertyId(p.id);
                    }
                  }
                }
              })),
              // Matches - Spaces (scoped to property if selected)
              ...(propertyId ? spaces.map(s => ({
                id: `match-space-${s.id}`,
                label: s.name,
                type: 'match' as const,
                action: () => {
                  if (selectedSpaceIds.includes(s.id)) {
                    setSelectedSpaceIds(selectedSpaceIds.filter(id => id !== s.id));
                  } else {
                    setSelectedSpaceIds([...selectedSpaceIds, s.id]);
                  }
                }
              })) : []),
              // Actions - Create spaces from AI suggestions
              ...(aiResult?.spaces?.filter(s => 
                !spaces.some(existingSpace => existingSpace.name.toLowerCase() === s.name.toLowerCase())
              ).map(s => ({
                id: `action-create-space-${s.name}`,
                label: `Add space "${s.name}"…`,
                type: 'action' as const,
                action: () => {
                  if (!propertyId) {
                    toast({ 
                      title: "Select a property first",
                      description: "Choose a property before adding spaces.",
                      variant: "destructive"
                    });
                    return;
                  }
                  // Create ghost space (will be created on submit)
                  const ghostId = `ghost-space-${s.name}`;
                  setSelectedSpaceIds([...selectedSpaceIds, ghostId]);
                  toast({ title: `Space "${s.name}" will be created` });
                }
              })) || [])
            ]}
            onItemSelect={(item) => item.action?.()}
            blockingMessage={unresolvedSections.includes('where') ? "Resolve before creating." : undefined}
          />

          {/* WHEN Section */}
          <UnifiedTaskSection
            id="when"
            icon={Calendar}
            sectionName="When"
            placeholder="Set date or recurrence…"
            activeChips={getWhenActiveChips}
            isExpanded={activeSection === 'when'}
            onToggle={() => handleSectionToggle('when')}
            dropdownItems={[
              { id: 'today', label: 'Today', type: 'match' as const, action: () => setDueDate(new Date().toISOString().split("T")[0]) },
              { id: 'tomorrow', label: 'Tomorrow', type: 'match' as const, action: () => {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                setDueDate(tomorrow.toISOString().split("T")[0]);
              }},
              { id: 'this-week', label: 'This week', type: 'match' as const, action: () => {
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                setDueDate(nextWeek.toISOString().split("T")[0]);
              }},
              { id: 'next-week', label: 'Next week', type: 'match' as const, action: () => {
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 14);
                setDueDate(nextWeek.toISOString().split("T")[0]);
              }},
              { id: 'every-week', label: 'Every week', type: 'match' as const, action: () => setRepeatRule({ type: 'weekly', interval: 1 }) },
              { id: 'every-month', label: 'Every month', type: 'match' as const, action: () => setRepeatRule({ type: 'monthly', interval: 1 }) }
            ]}
            onItemSelect={(item) => item.action?.()}
          >
            {/* Custom expanded content for WHEN with calendar */}
            <div className="space-y-3">
              <DashboardCalendar
                selectedDate={dueDate ? new Date(dueDate) : undefined}
                onDateSelect={(date) => {
                  if (date) {
                    setDueDate(date.toISOString().split("T")[0]);
                  }
                }}
                className="mb-2"
              />
              <Input
                type="date"
                value={dueDate.split('T')[0] || dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-[5px] bg-input shadow-engraved focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {repeatRule && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Repeat:</span>
                  <Chip
                    role="fact"
                    label={`EVERY ${repeatRule.interval} ${repeatRule.type.toUpperCase()}`}
                    onRemove={() => setRepeatRule(undefined)}
                  />
                </div>
              )}
            </div>
          </UnifiedTaskSection>

          {/* ASSETS Section - Only show if property is selected */}
          {propertyId && (
            <UnifiedTaskSection
              id="assets"
              icon={Box}
              sectionName="Assets"
              placeholder="Add or create asset…"
              activeChips={getAssetsActiveChips}
              suggestionChips={getAssetsSuggestionChipsMemo}
              isExpanded={activeSection === 'assets'}
              onToggle={() => handleSectionToggle('assets')}
              dropdownItems={[
                // Matches - Existing assets
                ...assets.map(a => ({
                  id: `match-asset-${a.id}`,
                  label: a.name,
                  type: 'match' as const,
                  action: () => {
                    if (selectedAssetIds.includes(a.id)) {
                      setSelectedAssetIds(selectedAssetIds.filter(id => id !== a.id));
                    } else {
                      setSelectedAssetIds([...selectedAssetIds, a.id]);
                    }
                  }
                })),
                // Actions - Create assets from AI suggestions
                ...(aiResult?.assets?.filter(a => 
                  !assets.some(existing => existing.name.toLowerCase() === a.name.toLowerCase())
                ).map(a => ({
                  id: `action-create-asset-${a.name}`,
                  label: `Create asset "${a.name}"…`,
                  type: 'action' as const,
                  action: () => {
                    // Create ghost asset (will be created on submit)
                    const ghostId = `ghost-asset-${a.name}`;
                    setSelectedAssetIds([...selectedAssetIds, ghostId]);
                    toast({ title: `Asset "${a.name}" will be created` });
                  }
                })) || [])
              ]}
              onItemSelect={(item) => item.action?.()}
              blockingMessage={unresolvedSections.includes('assets') ? "Resolve before creating." : undefined}
            />
          )}

          {/* PRIORITY Section */}
          <UnifiedTaskSection
            id="priority"
            icon={AlertTriangle}
            sectionName="Priority"
            placeholder="Set priority…"
            activeChips={getPriorityActiveChips}
            isExpanded={activeSection === 'priority'}
            onToggle={() => handleSectionToggle('priority')}
            dropdownItems={[
              { id: 'low', label: 'Low', type: 'match' as const, action: () => setPriority('low') },
              { id: 'medium', label: 'Medium', type: 'match' as const, action: () => setPriority('medium') },
              { id: 'high', label: 'High', type: 'match' as const, action: () => setPriority('high') },
              { id: 'urgent', label: 'Urgent', type: 'match' as const, action: () => setPriority('urgent') }
            ]}
            onItemSelect={(item) => item.action?.()}
          />

          {/* CATEGORY Section */}
          <UnifiedTaskSection
            id="category"
            icon={Tag}
            sectionName="Category"
            placeholder="Add or create category…"
            activeChips={getCategoryActiveChips}
            isExpanded={activeSection === 'category'}
            onToggle={() => handleSectionToggle('category')}
            dropdownItems={[
              // Matches - Existing themes (categories, projects, tags, groups)
              ...themes.map(t => ({
                id: `match-theme-${t.id}`,
                label: t.name,
                type: 'match' as const,
                action: () => {
                  if (selectedThemeIds.includes(t.id)) {
                    setSelectedThemeIds(selectedThemeIds.filter(id => id !== t.id));
                  } else {
                    setSelectedThemeIds([...selectedThemeIds, t.id]);
                  }
                }
              })),
              // Actions - Create themes from AI suggestions
              ...(aiResult?.themes?.filter(t => 
                !themes.some(existing => existing.name.toLowerCase() === t.name.toLowerCase())
              ).map(t => ({
                id: `action-create-theme-${t.name}`,
                label: `Create ${t.type} "${t.name}"…`,
                type: 'action' as const,
                action: () => {
                  // Create ghost theme
                  const ghostId = `ghost-theme-${t.name}-${t.type}`;
                  setSelectedThemeIds([...selectedThemeIds, ghostId]);
                  toast({ title: `${t.type.charAt(0).toUpperCase() + t.type.slice(1)} "${t.name}" will be created` });
                }
              })) || [])
            ]}
            onItemSelect={(item) => item.action?.()}
          />

          {/* COMPLIANCE & ADVANCED Section */}
          <UnifiedTaskSection
            id="compliance"
            icon={Shield}
            sectionName="Compliance & Advanced"
            placeholder="Configure compliance and advanced options…"
            activeChips={[
              ...(isCompliance ? [{
                id: 'compliance-chip',
                label: 'COMPLIANCE',
                onRemove: () => setIsCompliance(false)
              }] : []),
              ...(complianceLevel ? [{
                id: `compliance-level-${complianceLevel}`,
                label: complianceLevel.toUpperCase(),
                onRemove: () => setComplianceLevel("")
              }] : []),
              ...(annotationRequired ? [{
                id: 'annotation-chip',
                label: 'PHOTO ANNOTATION',
                onRemove: () => setAnnotationRequired(false)
              }] : [])
            ]}
            isExpanded={activeSection === 'compliance'}
            onToggle={() => handleSectionToggle('compliance')}
            dropdownItems={[]}
            onItemSelect={() => {}}
            description="Configure regulatory compliance, annotation requirements, and advanced task settings"
          >
            {/* Custom expanded content for Compliance & Advanced */}
            <div className="space-y-4">
              {/* Compliance Toggle */}
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

              {/* Annotation Required */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="annotation" className="text-sm">Requires Photo Annotation</Label>
                  <p className="text-xs text-muted-foreground">Enforce photo markup on completion</p>
                </div>
                <Switch id="annotation" checked={annotationRequired} onCheckedChange={setAnnotationRequired} />
              </div>
            </div>
          </UnifiedTaskSection>
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

      </div>

      {/* Footer */}
      <div className="flex flex-col gap-3 p-4 bg-card/80" style={{
        borderTopWidth: '0px',
        borderTopColor: 'rgba(0, 0, 0, 0)',
        borderTopStyle: 'none',
        borderImage: 'none',
        backdropFilter: 'none',
        boxShadow: 'inset -1px -1px 2px 0px rgba(0, 0, 0, 0.25)'
      }}>
        {/* Clarity State - Only show if blocking */}
        {clarityState && clarityState.severity === 'blocking' && (
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
          {clarityState?.severity === 'blocking' || verbChips.length > 0 ? (
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

  // For column variant on wide screens, render inline (not Dialog)
  // When variant="column", always render inline - the parent layout handles sizing
  if (variant === "column") {
    const accordionBodyId = "create-task-accordion-body";
    const isExpanded = open;

    return (
      <div className="h-auto flex flex-col bg-background rounded-lg shadow-[2px_4px_6px_0px_rgba(0,0,0,0.15),inset_1px_1px_2px_0px_rgba(255,255,255,1),inset_-1px_-1px_2px_0px_rgba(0,0,0,0.25)] border-0 relative overflow-hidden" style={{
        backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise-filter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.522\' numOctaves=\'1\' stitchTiles=\'stitch\'%3E%3C/feTurbulence%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'%3E%3C/feColorMatrix%3E%3CfeComponentTransfer%3E%3CfeFuncR type=\'linear\' slope=\'0.468\'%3E%3C/feFuncR%3E%3CfeFuncG type=\'linear\' slope=\'0.468\'%3E%3C/feFuncG%3E%3CfeFuncB type=\'linear\' slope=\'0.468\'%3E%3C/feFuncB%3E%3CfeFuncA type=\'linear\' slope=\'0.137\'%3E%3C/feFuncA%3E%3C/feComponentTransfer%3E%3CfeComponentTransfer%3E%3CfeFuncR type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3CfeFuncG type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3CfeFuncB type=\'linear\' slope=\'1.323\' intercept=\'-0.207\'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise-filter)\' opacity=\'0.8\'%3E%3C/rect%3E%3C/svg%3E")',
        backgroundSize: '100%'
      }}>
        {/* Section Title */}
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
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[95vh]">
          {/* Mobile Close Button */}
          <div className="flex justify-end p-4 pb-0">
            <button
              onClick={() => onOpenChange(false)}
              className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>Create a new task with details, assignments, and metadata</DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}