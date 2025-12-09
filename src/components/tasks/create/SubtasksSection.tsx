import { useState } from "react";
import { Plus, MoreVertical, GripVertical, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface SubtaskInput {
  id: string;
  title: string;
  is_yes_no: boolean;
  requires_signature: boolean;
}

interface SubtasksSectionProps {
  subtasks: SubtaskInput[];
  onSubtasksChange: (subtasks: SubtaskInput[]) => void;
}

export function SubtasksSection({ subtasks, onSubtasksChange }: SubtasksSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleAdd = () => {
    const newSubtask: SubtaskInput = {
      id: crypto.randomUUID(),
      title: "",
      is_yes_no: false,
      requires_signature: false,
    };
    onSubtasksChange([...subtasks, newSubtask]);
    setExpandedId(newSubtask.id);
  };

  const handleRemove = (id: string) => {
    onSubtasksChange(subtasks.filter(s => s.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleUpdate = (id: string, updates: Partial<SubtaskInput>) => {
    onSubtasksChange(subtasks.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Subtasks / Checklist</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleAdd}
          className="h-7 px-2 text-xs gap-1"
        >
          <Plus className="h-3 w-3" />
          Add Item
        </Button>
      </div>

      <div className="shadow-engraved rounded-lg p-3 bg-muted/20">
        {subtasks.length > 0 ? (
          <div className="space-y-2">
            {subtasks.map((subtask, idx) => (
              <div 
                key={subtask.id} 
                className={cn(
                  "rounded-lg border transition-all",
                  expandedId === subtask.id 
                    ? "bg-card shadow-e2 border-primary/30" 
                    : "bg-background/50 border-transparent"
                )}
              >
                {/* Main Row */}
                <div className="flex items-center gap-2 p-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab" />
                  <span className="font-mono text-xs text-muted-foreground w-5">
                    {idx + 1}.
                  </span>
                  <Input
                    placeholder="Subtask title..."
                    value={subtask.title}
                    onChange={(e) => handleUpdate(subtask.id, { title: e.target.value })}
                    className="flex-1 h-8 text-sm border-0 bg-transparent shadow-none focus-visible:ring-0"
                  />
                  <div className="flex items-center gap-1">
                    {subtask.is_yes_no && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">Y/N</span>
                    )}
                    {subtask.requires_signature && (
                      <FileSignature className="h-3 w-3 text-accent" />
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                      >
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => toggleExpand(subtask.id)}>
                        {expandedId === subtask.id ? "Collapse" : "Edit Options"}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleRemove(subtask.id)}
                        className="text-destructive"
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Expanded Options */}
                {expandedId === subtask.id && (
                  <div className="px-4 pb-3 pt-1 border-t border-border/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs">Yes/No Question</Label>
                        <p className="text-xs text-muted-foreground">Requires explicit yes or no answer</p>
                      </div>
                      <Switch
                        checked={subtask.is_yes_no}
                        onCheckedChange={(checked) => handleUpdate(subtask.id, { is_yes_no: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs">Requires Signature</Label>
                        <p className="text-xs text-muted-foreground">Must be signed on completion</p>
                      </div>
                      <Switch
                        checked={subtask.requires_signature}
                        onCheckedChange={(checked) => handleUpdate(subtask.id, { requires_signature: checked })}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-xs text-muted-foreground">
            No subtasks yet. Add items to create a checklist.
          </div>
        )}
      </div>
    </div>
  );
}
