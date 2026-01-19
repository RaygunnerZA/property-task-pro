import { useState, useRef, useCallback, memo } from "react";
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

function SubtasksSectionInner({
  subtasks,
  onSubtasksChange,
  description = "",
  onDescriptionChange
}: SubtasksSectionProps) {
  // #region agent log
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;
  if (renderCountRef.current > 50 && renderCountRef.current % 10 === 0) {
    console.error('[SubtasksSection] RENDER LOOP DETECTED:', {
      renderCount: renderCountRef.current,
      subtasksLength: subtasks.length,
      hasDescription: !!description,
      descriptionLength: description?.length || 0,
    });
  }
  // #endregion
  
  const [isAddingFirst, setIsAddingFirst] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);
  
  // Use refs to track state and prevent loops
  const isAddingRef = useRef(false);
  const lastSubtasksLengthRef = useRef(subtasks.length);
  lastSubtasksLengthRef.current = subtasks.length;
  
  // Memoize callback WITHOUT depending on subtasks.length to prevent recreation on every render
  const handleAddFirstSubtask = useCallback(() => {
    // #region agent log
    console.log('[SubtasksSection] handleAddFirstSubtask called', {
      currentSubtasksLength: lastSubtasksLengthRef.current,
      isAdding: isAddingRef.current,
    });
    // #endregion
    
    // Guard: prevent multiple simultaneous calls
    if (isAddingRef.current) {
      console.warn('[SubtasksSection] handleAddFirstSubtask already in progress, ignoring duplicate call');
      return;
    }
    
    // Guard: only add if currently empty (check ref, not prop to avoid dependency)
    if (lastSubtasksLengthRef.current === 0) {
      isAddingRef.current = true;
      const newSubtask: SubtaskInput = {
        id: crypto.randomUUID(),
        title: "",
        is_yes_no: false,
        requires_signature: false
      };
      console.log('[SubtasksSection] Creating new subtask', newSubtask.id);
      onSubtasksChange([newSubtask]);
      setIsAddingFirst(true);
      // Reset guard after state settles
      setTimeout(() => {
        isAddingRef.current = false;
        console.log('[SubtasksSection] Guard reset');
      }, 500);
    } else {
      console.log('[SubtasksSection] Skipping - subtasks already exist', lastSubtasksLengthRef.current);
    }
  }, [onSubtasksChange]); // Only depend on onSubtasksChange, not subtasks.length
  
  const handleReorder = useCallback((ids: string[]) => {
    // This callback can be used to update order_index in the database
    console.log("Reordered subtasks:", ids);
  }, []);

  // If no subtasks, show the "add subtask" placeholder row
  const showPlaceholder = subtasks.length === 0;
  return <div 
      className="shadow-engraved rounded-lg overflow-hidden text-white bg-white/80 mt-3"
      style={{
        backgroundClip: 'unset',
        WebkitBackgroundClip: 'unset',
        backgroundImage: 'none',
        paddingTop: '0px'
      }}
    >
      {/* Description Area */}
      <div className="pt-[8px] pb-3 bg-black/0" style={{ paddingLeft: '15px', paddingRight: '15px', height: '80px' }}>
        <Textarea 
          placeholder="What needs doing?" 
          value={description || ''} 
          onChange={(e) => {
            const newValue = e.target.value;
            // #region agent log
            const changed = newValue !== description;
            if (changed) {
              console.log('[SubtasksSection] Textarea onChange:', {
                prevLength: description?.length || 0,
                newLength: newValue.length,
                prevValue: description?.substring(0, 30),
                newValue: newValue.substring(0, 30),
              });
            } else {
              console.warn('[SubtasksSection] Textarea onChange called with same value!', {
                length: newValue.length,
              });
            }
            // #endregion
            // Only call onChange if value actually changed (prevent unnecessary updates)
            if (changed) {
              onDescriptionChange?.(newValue);
            }
          }} 
          rows={2} 
          className="box-content border-0 bg-transparent shadow-none focus-visible:ring-0 p-0 text-base font-normal text-foreground placeholder:text-muted-foreground/60 resize-none min-h-[80px]" 
          style={{ fontFamily: '"Inter Tight"', boxShadow: 'none', lineHeight: '22px' }} 
        />
      </div>

      {/* Divider */}
      <div className="h-px bg-border/30 mx-4" />

      {/* Subtasks Area */}
      <div className="px-4 py-[6px] pt-0">
        {showPlaceholder ? (/* Empty State - Add Subtask Placeholder */
      <div className="flex items-center gap-3 py-2 cursor-pointer group" onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleAddFirstSubtask();
        }}>
            <div className="h-3 w-3 rounded-lg border-2 border-muted-foreground/20 bg-background/50" />
            <span className="flex-1 text-muted-foreground/50 text-sm">
              Add subtask
            </span>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}>
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border shadow-e2" onCloseAutoFocus={(e) => e.preventDefault()}>
                <DropdownMenuItem onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAddFirstSubtask();
                }}>
                  Add Subtask
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => {
                  e.preventDefault();
                }}>
                  Import from Template
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>) : (
          <>
            {/* Subtask List with DnD */}
            <SubtaskList subtasks={subtasks} isCreator={true} onSubtasksChange={onSubtasksChange} onReorder={handleReorder} />
            {/* Make Checklist | Save as Template - shown after 3 subtasks */}
            {subtasks.length > 3 && (
              <div className="flex items-center justify-center gap-4 pt-2 mt-1 text-xs text-muted-foreground/60">
                <button 
                  type="button"
                  className="hover:text-muted-foreground transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    // TODO: Implement Make Checklist functionality
                    console.log("Make Checklist clicked");
                  }}
                >
                  + Make Checklist
                </button>
                <span className="text-muted-foreground/30">|</span>
                <button 
                  type="button"
                  className="hover:text-muted-foreground transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    // TODO: Implement Save as Template functionality
                    console.log("Save as Template clicked");
                  }}
                >
                  Save as Template
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>;
}

// Memoize component to prevent re-renders when props haven't changed
export const SubtasksSection = memo(SubtasksSectionInner, (prevProps, nextProps) => {
  // Compare description by value (content), not reference
  // Normalize both to strings for comparison
  const prevDesc = String(prevProps.description || '');
  const nextDesc = String(nextProps.description || '');
  const descriptionEqual = prevDesc === nextDesc;
  const descriptionRefEqual = prevProps.description === nextProps.description;
  
  // Compare subtasks by length and IDs (not full deep comparison for performance)
  const subtasksLengthEqual = prevProps.subtasks.length === nextProps.subtasks.length;
  const subtasksIdsEqual = subtasksLengthEqual && prevProps.subtasks.every((prev, idx) => {
    const next = nextProps.subtasks[idx];
    return prev?.id === next?.id;
  });
  const subtasksEqual = subtasksIdsEqual && prevProps.subtasks === nextProps.subtasks;
  
  // #region agent log
  const propsChanged = {
    subtasksLength: !subtasksLengthEqual,
    subtasksIdsEqual,
    subtasksRefEqual: prevProps.subtasks === nextProps.subtasks,
    subtasksEqual,
    descriptionValueEqual: descriptionEqual,
    descriptionRefEqual,
    descriptionEqual,
    onSubtasksChange: prevProps.onSubtasksChange !== nextProps.onSubtasksChange,
    onDescriptionChange: prevProps.onDescriptionChange !== nextProps.onDescriptionChange,
    className: prevProps.className !== nextProps.className,
  };
  
  // Only log if something actually changed
  const shouldRender = !subtasksEqual || !descriptionEqual || propsChanged.onSubtasksChange || propsChanged.onDescriptionChange || propsChanged.className;
  if (shouldRender) {
    console.log('[SubtasksSection] Props changed, will re-render', {
      ...propsChanged,
      prevDescriptionLength: prevDesc.length,
      nextDescriptionLength: nextDesc.length,
      prevDescription: prevDesc.substring(0, 50),
      nextDescription: nextDesc.substring(0, 50),
      prevSubtasksLength: prevProps.subtasks.length,
      nextSubtasksLength: nextProps.subtasks.length,
    });
  }
  // #endregion
  
  // Return true if props are equal (should NOT re-render), false if different (should re-render)
  // IMPORTANT: React.memo comparison returns:
  // - true = props are equal, DON'T re-render
  // - false = props are different, DO re-render
  const shouldSkipRender = 
    subtasksEqual &&
    descriptionEqual &&
    prevProps.onSubtasksChange === nextProps.onSubtasksChange &&
    prevProps.onDescriptionChange === nextProps.onDescriptionChange &&
    prevProps.className === nextProps.className;
  
  // #region agent log
  // Log when we're going to re-render due to memo comparison failure
  if (!shouldSkipRender) {
    console.log('[SubtasksSection] Memo comparison: will re-render', {
      subtasksEqual,
      descriptionEqual,
      descriptionValueEqual: prevDesc === nextDesc,
      descriptionRefEqual: prevProps.description === nextProps.description,
      onSubtasksChangeEqual: prevProps.onSubtasksChange === nextProps.onSubtasksChange,
      onDescriptionChangeEqual: prevProps.onDescriptionChange === nextProps.onDescriptionChange,
      classNameEqual: prevProps.className === nextProps.className,
      prevDescLength: prevDesc.length,
      nextDescLength: nextDesc.length,
    });
  }
  // #endregion
    
  return shouldSkipRender;
});