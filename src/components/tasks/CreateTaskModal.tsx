import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  X, Plus, Sparkles, ChevronDown, ChevronUp, 
  User, Calendar, MapPin, AlertTriangle,
  ListTodo, Shield
} from "lucide-react";
import { 
  Dialog, 
  DialogContent
} from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useDataContext } from "@/contexts/DataContext";
import { useChecklistTemplates } from "@/hooks/useChecklistTemplates";
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

import type { 
  CreateTaskPayload, 
  TaskPriority, 
  RepeatRule,
  CreateTaskImagePayload 
} from "@/types/database";

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
  const { toast } = useToast();
  const { orgId } = useDataContext();
  const { templates } = useChecklistTemplates();
  const isMobile = useIsMobile();
  
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [propertyId, setPropertyId] = useState(defaultPropertyId || "");
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<TaskPriority>("normal");
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

  // AI Suggestion chips (mock for now)
  const [aiSuggestions] = useState<string[]>([]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setPropertyId(defaultPropertyId || "");
    setSelectedSpaceIds([]);
    setPriority("normal");
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
    if (!title.trim()) {
      toast({ 
        title: "Title required", 
        description: "Please enter a task title.",
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
        title: title.trim(),
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
          ai: aiSuggestions.length > 0 ? { chips: aiSuggestions } : undefined,
        },
        template_id: templateId || undefined,
        subtasks: subtasks.filter(s => s.title.trim()).map((s, idx) => ({
          title: s.title.trim(),
          is_yes_no: s.is_yes_no,
          requires_signature: s.requires_signature,
          order_index: idx,
        })),
        groups: selectedGroupIds.length > 0 ? selectedGroupIds : undefined,
        images: images.length > 0 ? images : undefined,
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

  const content = (
    <div className="flex flex-col h-full max-h-[85vh]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary" />
          Create Task
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Image Upload */}
        <ImageUploadSection 
          images={images} 
          onImagesChange={setImages} 
        />

        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title" className="text-sm font-medium">Title *</Label>
          <div className="relative">
            <Input
              id="title"
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="pr-10 shadow-engraved text-base"
            />
            <button 
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-primary hover:text-primary/80 transition-colors"
              title="AI suggestions"
            >
              <Sparkles className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-medium">Description</Label>
          <Textarea
            id="description"
            placeholder="Add details about this task..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="shadow-engraved resize-none"
          />
        </div>

        {/* AI Suggestion Chips */}
        {aiSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {aiSuggestions.map((chip, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className="font-mono text-xs uppercase cursor-pointer hover:bg-primary hover:text-primary-foreground transition-all"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                {chip}
              </Badge>
            ))}
          </div>
        )}

        {/* Metadata Tabs */}
        <div className="rounded-xl bg-card shadow-e2 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-4 h-11 bg-muted/50 p-1 rounded-none">
              <TabsTrigger value="where" className="gap-1 text-xs data-[state=active]:shadow-e1">
                <MapPin className="h-3 w-3" />
                <span className="hidden sm:inline">Where</span>
              </TabsTrigger>
              <TabsTrigger value="when" className="gap-1 text-xs data-[state=active]:shadow-e1">
                <Calendar className="h-3 w-3" />
                <span className="hidden sm:inline">When</span>
              </TabsTrigger>
              <TabsTrigger value="who" className="gap-1 text-xs data-[state=active]:shadow-e1">
                <User className="h-3 w-3" />
                <span className="hidden sm:inline">Who</span>
              </TabsTrigger>
              <TabsTrigger value="priority" className="gap-1 text-xs data-[state=active]:shadow-e1">
                <AlertTriangle className="h-3 w-3" />
                <span className="hidden sm:inline">Priority</span>
              </TabsTrigger>
            </TabsList>

            <div className="p-4">
              <TabsContent value="where" className="mt-0">
                <WhereTab
                  propertyId={propertyId}
                  spaceIds={selectedSpaceIds}
                  onPropertyChange={setPropertyId}
                  onSpacesChange={setSelectedSpaceIds}
                />
              </TabsContent>
              <TabsContent value="when" className="mt-0">
                <WhenTab
                  dueDate={dueDate}
                  repeatRule={repeatRule}
                  onDueDateChange={setDueDate}
                  onRepeatRuleChange={setRepeatRule}
                />
              </TabsContent>
              <TabsContent value="who" className="mt-0">
                <WhoTab
                  assignedUserId={assignedUserId}
                  assignedTeamIds={assignedTeamIds}
                  onUserChange={setAssignedUserId}
                  onTeamsChange={setAssignedTeamIds}
                />
              </TabsContent>
              <TabsContent value="priority" className="mt-0">
                <PriorityTab
                  priority={priority}
                  onPriorityChange={setPriority}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Subtasks */}
        <div className="rounded-xl bg-card shadow-e2 p-4">
          <SubtasksSection 
            subtasks={subtasks} 
            onSubtasksChange={setSubtasks} 
          />
        </div>

        {/* Groups */}
        <div className="rounded-xl bg-card shadow-e2 p-4">
          <GroupsSection
            selectedGroupIds={selectedGroupIds}
            onGroupsChange={setSelectedGroupIds}
          />
        </div>

        {/* Checklist Template */}
        {templates.length > 0 && (
          <div className="space-y-2">
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
                {templates.map(template => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.icon && <span className="mr-2">{template.icon}</span>}
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Advanced Options Toggle */}
        <button
          type="button"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <Shield className="h-4 w-4" />
          Compliance & Advanced
        </button>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="space-y-4 p-4 rounded-xl bg-muted/50 shadow-engraved">
            {/* Compliance Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="compliance" className="text-sm">Compliance Task</Label>
                <p className="text-xs text-muted-foreground">Mark as regulatory requirement</p>
              </div>
              <Switch
                id="compliance"
                checked={isCompliance}
                onCheckedChange={setIsCompliance}
              />
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
              <Switch
                id="annotation"
                checked={annotationRequired}
                onCheckedChange={setAnnotationRequired}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-3 p-4 border-t border-border bg-card/80 backdrop-blur">
        <Button 
          variant="outline" 
          className="flex-1 shadow-e1"
          onClick={() => onOpenChange(false)}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button 
          className="flex-1 shadow-primary-btn"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating..." : "Create Task"}
        </Button>
      </div>
    </div>
  );

  // Mobile: Bottom sheet drawer, Desktop: Center dialog
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[95vh]">
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        {content}
      </DialogContent>
    </Dialog>
  );
}
