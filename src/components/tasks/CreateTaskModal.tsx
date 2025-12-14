import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, Plus, Sparkles, ChevronDown, ChevronUp, User, Calendar, MapPin, AlertTriangle, ListTodo, Shield } from "lucide-react";
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
import { useDataContext } from "@/contexts/DataContext";
import { useChecklistTemplates } from "@/hooks/useChecklistTemplates";
import { useLastUsedProperty } from "@/hooks/useLastUsedProperty";
import { createTask } from "@/services/tasks/taskMutations";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

// Tab Components
import { WhoTab } from "./create/tabs/WhoTab";
import { WhenTab } from "./create/tabs/WhenTab";
import { WhereTab } from "./create/tabs/WhereTab";
import { PriorityTab } from "./create/tabs/PriorityTab";

// Section Components
import { SubtasksSection, type SubtaskInput } from "./create/SubtasksSection";
import { ImageUploadSection } from "./create/ImageUploadSection";
import { GroupsSection } from "./create/GroupsSection";
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
    orgId
  } = useDataContext();
  const {
    templates
  } = useChecklistTemplates();
  const { lastUsedPropertyId, setLastUsed } = useLastUsedProperty();
  const isMobile = useIsMobile();

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
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
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
    setSelectedGroupIds([]);
    setImages([]);
    setShowAdvanced(false);
    setActiveTab("where");
  };
  const handleSubmit = async () => {
    // Auto-generate title if empty
    let finalTitle = title.trim();
    if (!finalTitle) {
      finalTitle = aiTitleGenerated || description.slice(0, 50).trim();
    }
    
    if (!finalTitle) {
      toast({
        title: "Description required",
        description: "Please describe the task.",
        variant: "destructive"
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
      const payload: CreateTaskPayload = {
        title: finalTitle,
        description: description.trim() || undefined,
        property_id: propertyId || undefined,
        space_ids: selectedSpaceIds.length > 0 ? selectedSpaceIds : undefined,
        priority,
        due_at: dueDate ? new Date(dueDate).toISOString() : undefined,
        assigned_user_id: assignedUserId,
        assigned_team_ids: assignedTeamIds.length > 0 ? assignedTeamIds : undefined,
        is_compliance: isCompliance,
        compliance_level: isCompliance ? complianceLevel : undefined,
        annotation_required: annotationRequired,
        metadata: {
          repeat: repeatRule,
          ai: aiSuggestions ? {
            chips: [
              ...(aiSuggestions.spaces || []),
              ...(aiSuggestions.people || []),
              ...(aiSuggestions.groups || []),
              aiSuggestions.priority
            ].filter(Boolean) as string[]
          } : undefined
        },
        template_id: templateId || undefined,
        subtasks: subtasks.filter(s => s.title.trim()).map((s, idx) => ({
          title: s.title.trim(),
          is_yes_no: s.is_yes_no,
          requires_signature: s.requires_signature,
          order_index: idx
        })),
        groups: selectedGroupIds.length > 0 ? selectedGroupIds : undefined,
        images: images.length > 0 ? images : undefined
      };
      const taskId = await createTask(orgId, propertyId || null, payload);
      toast({
        title: "Task created",
        description: "Your task has been added successfully."
      });
      resetForm();
      onOpenChange(false);
      onTaskCreated?.(taskId);
    } catch (error: any) {
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
                  className="font-mono text-xs uppercase cursor-pointer hover:bg-primary hover:text-primary-foreground transition-all"
                  onClick={() => setActiveTab("where")}
                >
                  <MapPin className="h-3 w-3 mr-1" />
                  + {space}
                </Badge>
              ))}
              {aiSuggestions.people.map((person, idx) => (
                <Badge 
                  key={`person-${idx}`} 
                  variant="outline" 
                  className="font-mono text-xs uppercase cursor-pointer hover:bg-primary hover:text-primary-foreground transition-all"
                  onClick={() => setActiveTab("who")}
                >
                  <User className="h-3 w-3 mr-1" />
                  + {person}
                </Badge>
              ))}
              {aiSuggestions.assets.map((asset, idx) => (
                <Badge 
                  key={`asset-${idx}`} 
                  variant="secondary" 
                  className="font-mono text-xs uppercase"
                >
                  {asset}
                </Badge>
              ))}
              {aiSuggestions.priority === "HIGH" && (
                <Badge 
                  variant="destructive" 
                  className="font-mono text-xs uppercase cursor-pointer"
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
                  className="font-mono text-xs uppercase cursor-pointer hover:bg-primary hover:text-primary-foreground transition-all"
                  onClick={() => setActiveTab("when")}
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  {aiSuggestions.date.replace("_", " ")}
                </Badge>
              )}
              {aiSuggestions.yes_no && (
                <Badge variant="secondary" className="font-mono text-xs uppercase">
                  ✓ Yes/No
                </Badge>
              )}
              {aiSuggestions.signature && (
                <Badge 
                  variant="outline" 
                  className="font-mono text-xs uppercase cursor-pointer hover:bg-primary hover:text-primary-foreground transition-all border-amber-500 text-amber-600"
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
        <div className="rounded-xl overflow-hidden bg-[#298ba1]/30">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="bg-black/0">
            <TabsList className="w-full grid grid-cols-4 h-11 bg-muted/50 p-1 rounded-none">
              <TabsTrigger value="where" className="gap-1 text-xs text-muted-foreground/60 data-[state=active]:text-foreground data-[state=active]:bg-background rounded-[5px]">
                <MapPin className="h-3 w-3" />
                <span className="hidden sm:inline">Where</span>
              </TabsTrigger>
              <TabsTrigger value="when" className="gap-1 text-xs text-muted-foreground/60 data-[state=active]:text-foreground data-[state=active]:bg-background rounded-[5px]">
                <Calendar className="h-3 w-3" />
                <span className="hidden sm:inline">When</span>
              </TabsTrigger>
              <TabsTrigger value="who" className="gap-1 text-xs text-muted-foreground/60 data-[state=active]:text-foreground data-[state=active]:bg-background rounded-[5px]">
                <User className="h-3 w-3" />
                <span className="hidden sm:inline">Who</span>
              </TabsTrigger>
              <TabsTrigger value="priority" className="gap-1 text-xs text-muted-foreground/60 data-[state=active]:text-foreground data-[state=active]:bg-background rounded-[5px]">
                <AlertTriangle className="h-3 w-3" />
                <span className="hidden sm:inline">Priority</span>
              </TabsTrigger>
            </TabsList>

            <div className="p-4 bg-secondary">
              <TabsContent value="where" className="mt-0">
                <WhereTab 
                  propertyId={propertyId} 
                  spaceIds={selectedSpaceIds} 
                  onPropertyChange={handlePropertyChange} 
                  onSpacesChange={setSelectedSpaceIds}
                  suggestedSpaces={aiSuggestions?.spaces || []}
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
                  suggestedPeople={aiSuggestions?.people || []}
                />
              </TabsContent>
              <TabsContent value="priority" className="mt-0">
                <PriorityTab priority={priority} onPriorityChange={setPriority} />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Groups & Assets Row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl shadow-e2 p-4 bg-secondary">
            <GroupsSection 
              selectedGroupIds={selectedGroupIds} 
              onGroupsChange={setSelectedGroupIds}
              suggestedGroups={aiSuggestions?.groups || []}
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
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger className="shadow-engraved">
                <SelectValue placeholder="Choose a checklist template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
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