import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Plus, Calendar, ImagePlus, Sparkles, ChevronDown, ChevronUp, Repeat } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useDataContext } from "@/contexts/DataContext";
import { useProperties } from "@/hooks/useProperties";
import { useSpaces } from "@/hooks/useSpaces";
import { useChecklistTemplates } from "@/hooks/useChecklistTemplates";
import { createTask } from "@/services/tasks/taskMutations";
import type { CreateTaskPayload, CreateSubtaskPayload, TaskPriority } from "@/types/database";
import { cn } from "@/lib/utils";

interface CreateTaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated?: (taskId: string) => void;
  defaultPropertyId?: string;
}

interface SubtaskInput {
  id: string;
  title: string;
  is_yes_no: boolean;
  requires_signature: boolean;
}

export function CreateTaskModal({ 
  open, 
  onOpenChange, 
  onTaskCreated,
  defaultPropertyId 
}: CreateTaskModalProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { orgId } = useDataContext();
  const { properties } = useProperties();
  const { templates } = useChecklistTemplates();
  
  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [propertyId, setPropertyId] = useState(defaultPropertyId || "");
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [dueDate, setDueDate] = useState("");
  const [isCompliance, setIsCompliance] = useState(false);
  const [complianceLevel, setComplianceLevel] = useState("");
  const [annotationRequired, setAnnotationRequired] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [subtasks, setSubtasks] = useState<SubtaskInput[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Get spaces for selected property
  const { spaces } = useSpaces(propertyId || undefined);

  const handleAddSubtask = () => {
    setSubtasks([
      ...subtasks,
      { 
        id: crypto.randomUUID(), 
        title: "", 
        is_yes_no: false, 
        requires_signature: false 
      }
    ]);
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks(subtasks.filter(s => s.id !== id));
  };

  const handleUpdateSubtask = (id: string, updates: Partial<SubtaskInput>) => {
    setSubtasks(subtasks.map(s => s.id === id ? { ...s, ...updates } : s));
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
        is_compliance: isCompliance,
        compliance_level: isCompliance ? complianceLevel : undefined,
        annotation_required: annotationRequired,
        template_id: templateId || undefined,
        subtasks: subtasks.filter(s => s.title.trim()).map((s, idx) => ({
          title: s.title.trim(),
          is_yes_no: s.is_yes_no,
          requires_signature: s.requires_signature,
          order_index: idx,
        })),
      };

      const taskId = await createTask(orgId, propertyId || null, payload);

      toast({ 
        title: "Task created", 
        description: "Your task has been added successfully." 
      });

      // Reset form
      setTitle("");
      setDescription("");
      setPropertyId(defaultPropertyId || "");
      setSelectedSpaceIds([]);
      setPriority("normal");
      setDueDate("");
      setIsCompliance(false);
      setComplianceLevel("");
      setAnnotationRequired(false);
      setTemplateId("");
      setSubtasks([]);
      setShowAdvanced(false);

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

  const toggleSpaceSelection = (spaceId: string) => {
    setSelectedSpaceIds(prev => 
      prev.includes(spaceId) 
        ? prev.filter(id => id !== spaceId)
        : [...prev, spaceId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create Task
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <div className="relative">
              <Input
                id="title"
                placeholder="What needs to be done?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="pr-10"
              />
              <button 
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-primary hover:text-primary/80"
                title="AI suggestions"
              >
                <Sparkles className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Add details about this task..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Property */}
          <div className="space-y-2">
            <Label>Property</Label>
            <Select value={propertyId} onValueChange={(val) => {
              setPropertyId(val);
              setSelectedSpaceIds([]); // Reset spaces when property changes
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select a property" />
              </SelectTrigger>
              <SelectContent>
                {properties.map(property => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.nickname || property.address}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Spaces (if property selected) */}
          {propertyId && spaces.length > 0 && (
            <div className="space-y-2">
              <Label>Spaces</Label>
              <div className="flex flex-wrap gap-2">
                {spaces.map(space => (
                  <Badge
                    key={space.id}
                    variant={selectedSpaceIds.includes(space.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleSpaceSelection(space.id)}
                  >
                    {space.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Priority & Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(val) => setPriority(val as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <div className="relative">
                <Input
                  id="dueDate"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="pl-9"
                />
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Checklist Template */}
          {templates.length > 0 && (
            <div className="space-y-2">
              <Label>Checklist Template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Apply a template (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {templates.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Subtasks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Subtasks</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleAddSubtask}
                className="h-7 px-2 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
            
            {subtasks.length > 0 && (
              <div className="space-y-2">
                {subtasks.map((subtask, idx) => (
                  <div key={subtask.id} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono w-4">
                      {idx + 1}.
                    </span>
                    <Input
                      placeholder="Subtask title"
                      value={subtask.title}
                      onChange={(e) => handleUpdateSubtask(subtask.id, { title: e.target.value })}
                      className="flex-1 h-8 text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveSubtask(subtask.id)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Advanced Options Toggle */}
          <button
            type="button"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Advanced Options
          </button>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="space-y-4 pt-2 border-t">
              {/* Compliance Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="compliance">Compliance Task</Label>
                  <p className="text-xs text-muted-foreground">Mark as regulatory/compliance requirement</p>
                </div>
                <Switch
                  id="compliance"
                  checked={isCompliance}
                  onCheckedChange={setIsCompliance}
                />
              </div>

              {isCompliance && (
                <div className="space-y-2">
                  <Label>Compliance Level</Label>
                  <Select value={complianceLevel} onValueChange={setComplianceLevel}>
                    <SelectTrigger>
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
                  <Label htmlFor="annotation">Requires Photo Annotation</Label>
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

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button 
            className="flex-1"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Create Task"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
