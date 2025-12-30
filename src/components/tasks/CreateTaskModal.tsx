import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Plus, Sparkles, ChevronDown, ChevronUp, User, Calendar, MapPin, AlertTriangle, ListTodo, Shield, Check } from "lucide-react";
import { useAITaskExtraction } from "@/hooks/useAITaskExtraction";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useChecklistTemplates } from "@/hooks/useChecklistTemplates";
import { useLastUsedProperty } from "@/hooks/useLastUsedProperty";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

// Tab Components
import { WhoTab } from "./create/tabs/WhoTab";
import { WhenTab } from "./create/tabs/WhenTab";
import { WhereTab } from "./create/tabs/WhereTab";
import { PriorityTab } from "./create/tabs/PriorityTab";

// Section Components
import { SubtasksSection, type SubtaskInput } from "./create/SubtasksSection";
import { ImageUploadSection } from "./create/ImageUploadSection";
import { ThemesSection } from "./create/ThemesSection";
import { AssetsSection } from "./create/AssetsSection";
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
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [propertyId, setPropertyId] = useState(defaultPropertyId || "");
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);

  // Initialize propertyId from last used when modal opens
  useEffect(() => {
    if (open && !defaultPropertyId && lastUsedPropertyId && !propertyId) {
      setPropertyId(lastUsedPropertyId);
    }
  }, [open, defaultPropertyId, lastUsedPropertyId]);

  // Update last used when property changes
  const handlePropertyChange = (newPropertyId: string) => {
    setPropertyId(newPropertyId);
    if (newPropertyId) {
      setLastUsed(newPropertyId);
    }
  };
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState(defaultDueDate || "");
  const [repeatRule, setRepeatRule] = useState<RepeatRule | undefined>();
  const [assignedUserId, setAssignedUserId] = useState<string | undefined>();
  const [assignedTeamIds, setAssignedTeamIds] = useState<string[]>([]);
  const [isCompliance, setIsCompliance] = useState(false);
  const [complianceLevel, setComplianceLevel] = useState("");
  const [annotationRequired, setAnnotationRequired] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [subtasks, setSubtasks] = useState<SubtaskInput[]>([]);
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);
  const [images, setImages] = useState<CreateTaskImagePayload[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("where");

  // AI Title extraction
  const [aiTitleGenerated, setAiTitleGenerated] = useState("");
  const [userEditedTitle, setUserEditedTitle] = useState(false);
  const [showTitleField, setShowTitleField] = useState(false);
  
  // Call AI extraction hook
  const { aiTitle, aiSuggestions, loading: aiLoading } = useAITaskExtraction(description);

  // Auto-update title from AI when user hasn't manually edited
  useEffect(() => {
    if (aiTitle && !userEditedTitle) {
      setAiTitleGenerated(aiTitle);
      setTitle(aiTitle);
      setShowTitleField(true);
    }
  }, [aiTitle, userEditedTitle]);

  // Auto-apply AI suggestions when received
  useEffect(() => {
    if (!aiSuggestions) return;
    
    // Auto-set priority from AI
    if (aiSuggestions.priority === "HIGH") {
      setPriority("high");
    }
    
    // Auto-set date suggestions including weekdays
    if (aiSuggestions.date) {
      const today = new Date();
      const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
      
      if (aiSuggestions.date === "today") {
        setDueDate(today.toISOString().split("T")[0]);
      } else if (aiSuggestions.date === "tomorrow") {
        today.setDate(today.getDate() + 1);
        setDueDate(today.toISOString().split("T")[0]);
      } else if (aiSuggestions.date === "next_week") {
        today.setDate(today.getDate() + 7);
        setDueDate(today.toISOString().split("T")[0]);
      } else if (weekdays.includes(aiSuggestions.date.toLowerCase())) {
        // Calculate next occurrence of the weekday
        const targetDay = weekdays.indexOf(aiSuggestions.date.toLowerCase());
        const currentDay = today.getDay();
        let daysToAdd = targetDay - currentDay;
        if (daysToAdd <= 0) daysToAdd += 7; // If today or in the past, go to next week
        today.setDate(today.getDate() + daysToAdd);
        setDueDate(today.toISOString().split("T")[0]);
      }
    }
    
    // Auto-enable compliance if signature is suggested
    if (aiSuggestions.signature && !isCompliance) {
      setIsCompliance(true);
      setShowAdvanced(true);
    }
  }, [aiSuggestions]);

  // Hide title field when description is empty
  useEffect(() => {
    if (!description.trim()) {
      setShowTitleField(false);
      setUserEditedTitle(false);
    }
  }, [description]);
  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPropertyId(defaultPropertyId || "");
    setSelectedSpaceIds([]);
    setPriority("medium");
    setDueDate(defaultDueDate || "");
    setRepeatRule(undefined);
    setAssignedUserId(undefined);
    setAssignedTeamIds([]);
    setIsCompliance(false);
    setComplianceLevel("");
    setAnnotationRequired(false);
    setTemplateId("");
    setSubtasks([]);
    setSelectedThemeIds([]);
    setImages([]);
    setShowAdvanced(false);
    setActiveTab("where");
  };
  const handleSubmit = async () => {
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
        
        if (!propertyId) {
          throw new Error(`Cannot create space "${spaceName}" without a property selected`);
        }
        
        const { data: newSpace, error: spaceError } = await supabase
          .from("spaces")
          .insert({
            org_id: orgId,
            property_id: propertyId,
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
      
      // Simplified: Use direct insert instead of RPC for reliability
      // RLS is now fixed, so we can use standard Supabase client
      console.log('[CreateTaskModal] Creating task with:', {
        orgId,
        title: finalTitle,
        propertyId: propertyId || null,
        priority: dbPriority,
        dueDate: dueDateValue,
        description: description.trim() || null,
        assignedUserId,
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
          assigned_user_id: assignedUserId || null,
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
      <div className="flex items-center justify-between p-4 border-b border-border">
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
          "transition-all duration-300 ease-out",
          showTitleField ? "opacity-100 max-h-24" : "opacity-0 max-h-0 overflow-hidden"
        )}>
          {showTitleField && (
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-primary" />
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

        {/* AI Suggestion Chips - Clickable to apply */}
        {aiSuggestions && (aiSuggestions.spaces.length > 0 || aiSuggestions.people.length > 0 || aiSuggestions.assets.length > 0 || aiSuggestions.priority) && (
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-primary" />
              AI Suggestions (click to apply)
            </label>
            <div className="flex flex-wrap gap-2">
              {aiSuggestions.spaces.map((space, idx) => (
                <Badge 
                  key={`space-${idx}`} 
                  variant="outline" 
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-all"
                  onClick={() => setActiveTab("where")}
                >
                  <MapPin className="h-3 w-3 mr-1" />
                  + {space.name}
                </Badge>
              ))}
              {aiSuggestions.people.map((person, idx) => (
                <Badge 
                  key={`person-${idx}`} 
                  variant="outline" 
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-all"
                  onClick={() => setActiveTab("who")}
                >
                  <User className="h-3 w-3 mr-1" />
                  + {person.name}
                </Badge>
              ))}
              {aiSuggestions.assets.map((asset, idx) => (
                <Badge 
                  key={`asset-${idx}`} 
                  variant="secondary"
                >
                  {asset}
                </Badge>
              ))}
              {aiSuggestions.priority === "HIGH" && (
                <Badge 
                  variant="danger" 
                  className="cursor-pointer"
                  onClick={() => {
                    setPriority("high");
                    setActiveTab("priority");
                  }}
                >
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  URGENT
                </Badge>
              )}
              {aiSuggestions.date && (
                <Badge 
                  variant="outline" 
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-all"
                  onClick={() => setActiveTab("when")}
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  {aiSuggestions.date.replace("_", " ")}
                </Badge>
              )}
              {aiSuggestions.yes_no && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  Yes/No
                </Badge>
              )}
              {aiSuggestions.signature && (
                <Badge 
                  variant="warning" 
                  className="cursor-pointer"
                  onClick={() => {
                    setIsCompliance(true);
                    setShowAdvanced(true);
                  }}
                >
                  <Shield className="h-3 w-3 mr-1" />
                  Compliance
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Metadata Tabs */}
        <div className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList
              className={cn(
                "w-full grid grid-cols-4 h-12 py-1 px-2 rounded-[15px] bg-transparent",
                "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.08),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]"
              )}
            >
              <TabsTrigger
                value="where"
                className={cn(
                  "rounded-lg transition-all gap-1",
                  "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]",
                  "data-[state=active]:bg-card",
                  "data-[state=inactive]:bg-transparent",
                  "text-sm font-medium"
                )}
              >
                <MapPin className="h-4 w-4" />
                <span className="hidden sm:inline">Where</span>
              </TabsTrigger>
              <TabsTrigger
                value="when"
                className={cn(
                  "rounded-lg transition-all gap-1",
                  "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]",
                  "data-[state=active]:bg-card",
                  "data-[state=inactive]:bg-transparent",
                  "text-sm font-medium"
                )}
              >
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">When</span>
              </TabsTrigger>
              <TabsTrigger
                value="who"
                className={cn(
                  "rounded-lg transition-all gap-1",
                  "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]",
                  "data-[state=active]:bg-card",
                  "data-[state=inactive]:bg-transparent",
                  "text-sm font-medium"
                )}
              >
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">Who</span>
              </TabsTrigger>
              <TabsTrigger
                value="priority"
                className={cn(
                  "rounded-lg transition-all gap-1",
                  "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]",
                  "data-[state=active]:bg-card",
                  "data-[state=inactive]:bg-transparent",
                  "text-sm font-medium"
                )}
              >
                <AlertTriangle className="h-4 w-4" />
                <span className="hidden sm:inline">Priority</span>
              </TabsTrigger>
            </TabsList>

            <div className="p-4 bg-background">
              <TabsContent value="where" className="mt-0">
                <WhereTab 
                  propertyId={propertyId} 
                  spaceIds={selectedSpaceIds} 
                  onPropertyChange={handlePropertyChange} 
                  onSpacesChange={setSelectedSpaceIds}
                  suggestedSpaces={aiSuggestions?.spaces?.map(s => s.name) || []}
                />
              </TabsContent>
              <TabsContent value="when" className="mt-0">
                <WhenTab dueDate={dueDate} repeatRule={repeatRule} onDueDateChange={setDueDate} onRepeatRuleChange={setRepeatRule} />
              </TabsContent>
              <TabsContent value="who" className="mt-0">
                <WhoTab 
                  assignedUserId={assignedUserId} 
                  assignedTeamIds={assignedTeamIds} 
                  onUserChange={setAssignedUserId} 
                  onTeamsChange={setAssignedTeamIds}
                  suggestedPeople={aiSuggestions?.people?.map(p => p.name) || []}
                />
              </TabsContent>
              <TabsContent value="priority" className="mt-0">
                <PriorityTab priority={priority} onPriorityChange={setPriority} />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Themes & Assets Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl shadow-e2 p-4 bg-secondary">
            <ThemesSection 
              selectedThemeIds={selectedThemeIds} 
              onThemesChange={setSelectedThemeIds}
              suggestedThemes={aiSuggestions?.themes?.map(t => ({ name: t.name, type: t.type })) || []}
            />
          </div>
          <div className="rounded-xl shadow-e2 p-4 bg-secondary">
            <AssetsSection
              selectedAssetIds={[]}
              onAssetsChange={() => {}}
              suggestedAssets={aiSuggestions?.assets || []}
            />
          </div>
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
      <div className="flex gap-3 p-4 border-t border-border bg-card/80 backdrop-blur">
        <Button variant="outline" className="flex-1 shadow-e1" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button className="flex-1 shadow-primary-btn" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Task"}
        </Button>
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
        {content}
      </DialogContent>
    </Dialog>;
}