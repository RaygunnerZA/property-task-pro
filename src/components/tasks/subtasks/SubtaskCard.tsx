import { useRef, useState, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, FileSignature } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SubtaskOptionsMenu } from "./SubtaskOptionsMenu";
import { cn } from "@/lib/utils";
export interface SubtaskData {
  id: string;
  title: string;
  is_yes_no: boolean;
  requires_signature: boolean;
}
interface SubtaskCardProps {
  subtask: SubtaskData;
  index: number;
  isCreator?: boolean;
  autoFocus?: boolean;
  onUpdate: (id: string, updates: Partial<SubtaskData>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onEnterPress: (id: string) => void;
  onBackspaceDelete: (id: string) => void;
  onFocusPrevious: (id: string) => void;
  onFocusNext: (id: string) => void;
}
export function SubtaskCard({
  subtask,
  index,
  isCreator = true,
  autoFocus = false,
  onUpdate,
  onDelete,
  onDuplicate,
  onEnterPress,
  onBackspaceDelete,
  onFocusPrevious,
  onFocusNext
}: SubtaskCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [backspaceCount, setBackspaceCount] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: subtask.id
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Reset backspace count when title changes
  useEffect(() => {
    if (subtask.title.length > 0) {
      setBackspaceCount(0);
    }
  }, [subtask.title]);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setShowOptions(false); // Collapse panel when moving to next question
      onEnterPress(subtask.id);
    } else if (e.key === "Backspace" && subtask.title === "") {
      e.preventDefault();
      if (backspaceCount >= 1) {
        // Second backspace - delete
        setIsDeleting(true);
        setTimeout(() => {
          onBackspaceDelete(subtask.id);
        }, 120);
      } else {
        setBackspaceCount(1);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      onFocusPrevious(subtask.id);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onFocusNext(subtask.id);
    }
  };
  const handleDelete = () => {
    setIsDeleting(true);
    setTimeout(() => {
      onDelete(subtask.id);
    }, 120);
  };
  const toggleYesNo = () => {
    const newValue = !subtask.is_yes_no;
    onUpdate(subtask.id, {
      is_yes_no: newValue
    });
    setShowOptions(newValue);
    // If converting to yes/no (turning it on), create a new subtask below
    if (newValue && !subtask.is_yes_no) {
      // Small delay to ensure state update completes
      setTimeout(() => {
        onEnterPress(subtask.id);
      }, 100);
    }
  };
  const toggleSignature = () => {
    const newValue = !subtask.requires_signature;
    onUpdate(subtask.id, {
      requires_signature: newValue
    });
    setShowOptions(newValue);
  };
  
  // Collapse options panel when moving to next question
  useEffect(() => {
    if (showOptions && !subtask.is_yes_no && !subtask.requires_signature) {
      setShowOptions(false);
    }
  }, [showOptions, subtask.is_yes_no, subtask.requires_signature]);
  return <div ref={setNodeRef} style={style} className={cn("transition-all duration-150", isDragging && "opacity-50 z-50", isDeleting && "opacity-0 scale-95")}>
      <div className={cn("rounded-xl bg-transparent shadow-e1 transition-shadow", isDragging && "shadow-e2")} style={{ color: "rgba(255, 255, 255, 0)", boxShadow: "none", border: "none" }}>
        {/* Main Row */}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded" style={{ color: "rgba(255, 255, 255, 0)", backgroundColor: "rgba(255, 255, 255, 0)" }}>
          {/* Drag Handle */}
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none">
            <GripVertical className="h-4 w-4 text-muted-foreground/40" />
          </div>

          {/* Index */}
          <span className="font-mono text-xs text-muted-foreground w-5 shrink-0">
            {index + 1}.
          </span>

          {/* Input */}
          <Input ref={inputRef} placeholder="Add subtask..." value={subtask.title} onChange={e => onUpdate(subtask.id, {
          title: e.target.value
        })} onKeyDown={handleKeyDown} className="flex-1 h-8 text-sm border-0 bg-transparent shadow-none focus-visible:ring-0 px-0" style={{ border: 'none', outline: 'none' }} />

          {/* Badges */}
          <div className="flex items-center gap-1.5 shrink-0">
            {subtask.is_yes_no && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono uppercase">
                Y/N
              </span>}
            {subtask.requires_signature && <FileSignature className="h-3.5 w-3.5 text-accent" />}
          </div>

          {/* Options Menu */}
          <SubtaskOptionsMenu isCreator={isCreator} onConvertToYesNo={toggleYesNo} onAddSignature={toggleSignature} onDuplicate={() => onDuplicate(subtask.id)} onDelete={handleDelete} />
        </div>

        {/* Expanded Options - Only show Yes/No toggle when is_yes_no is true */}
        {showOptions && subtask.is_yes_no && (
          <div className="px-4 pb-3 pt-1 border-t border-border/30">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-medium">Yes/No Question</Label>
                <p className="text-[11px] text-muted-foreground">
                  Requires explicit yes or no answer
                </p>
              </div>
              <Switch checked={subtask.is_yes_no} onCheckedChange={checked => {
                onUpdate(subtask.id, { is_yes_no: checked });
                if (!checked) setShowOptions(false);
              }} />
            </div>
          </div>
        )}
      </div>
    </div>;
}