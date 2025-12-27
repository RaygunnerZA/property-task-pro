import { useState, useRef, useEffect } from "react";
import { MoreHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SubtaskList, SubtaskData } from "../subtasks";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// Re-export for backwards compatibility
export type SubtaskInput = SubtaskData;
interface SubtasksSectionProps {
  subtasks: SubtaskInput[];
  onSubtasksChange: (subtasks: SubtaskInput[]) => void;
  description?: string;
  onDescriptionChange?: (description: string) => void;
  className?: string;
}
export function SubtasksSection({
  subtasks,
  onSubtasksChange,
  description = "",
  onDescriptionChange
}: SubtasksSectionProps) {
  const [isAddingFirst, setIsAddingFirst] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const handleAddFirstSubtask = () => {
    if (subtasks.length === 0) {
      const newSubtask: SubtaskInput = {
        id: crypto.randomUUID(),
        title: "",
        is_yes_no: false,
        requires_signature: false
      };
      onSubtasksChange([newSubtask]);
      setIsAddingFirst(true);
    }
  };
  const handleReorder = (ids: string[]) => {
    // This callback can be used to update order_index in the database
    console.log("Reordered subtasks:", ids);
  };

  // If no subtasks, show the "add subtask" placeholder row
  const showPlaceholder = subtasks.length === 0;
  return <div 
      className="shadow-engraved rounded-2xl overflow-hidden text-white bg-white/80"
      style={{
        backgroundClip: 'unset',
        WebkitBackgroundClip: 'unset',
        backgroundImage: 'none'
      }}
    >
      {/* Description Area */}
      <div className="px-5 pt-5 pb-3 bg-black/0">
        <Textarea placeholder="What needs doing?" value={description} onChange={e => onDescriptionChange?.(e.target.value)} rows={2} className="box-content border-0 bg-transparent shadow-none focus-visible:ring-0 p-0 text-xl font-normal text-foreground placeholder:text-muted-foreground/60 resize-none min-h-[80px]" style={{ fontFamily: '"Inter Tight"', boxShadow: 'none' }} />
      </div>

      {/* Divider */}
      <div className="h-px bg-border/30 mx-4" />

      {/* Subtasks Area */}
      <div className="px-4 py-[14px] pt-0">
        {showPlaceholder ? (/* Empty State - Add Subtask Placeholder */
      <div className="flex items-center gap-3 py-2 cursor-pointer group" onClick={handleAddFirstSubtask}>
            <div className="w-6 h-6 rounded-lg border-2 border-muted-foreground/20 bg-background/50" />
            <span className="flex-1 text-muted-foreground/50 text-base">
              add subtask
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border shadow-e2">
                <DropdownMenuItem onClick={handleAddFirstSubtask}>
                  Add Subtask
                </DropdownMenuItem>
                <DropdownMenuItem>
                  Import from Template
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>) : (/* Subtask List with DnD */
      <SubtaskList subtasks={subtasks} isCreator={true} onSubtasksChange={onSubtasksChange} onReorder={handleReorder} />)}
      </div>
    </div>;
}