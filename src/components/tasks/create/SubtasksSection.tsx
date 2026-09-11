import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SubtaskList, SubtaskData } from "../subtasks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  clipboardImageFiles,
  fileDropBind,
} from "@/utils/ingestIntakeMediaFiles";

// Re-export for backwards compatibility
export type SubtaskInput = SubtaskData;

interface SubtasksSectionProps {
  subtasks: SubtaskInput[];
  onSubtasksChange: (subtasks: SubtaskInput[]) => void;
  showDescription?: boolean;
  embedded?: boolean;
  description?: string;
  onDescriptionChange?: (description: string) => void;
  /** When pasting or dropping a file into the description, parent adds it like Add Photo. */
  onPasteImages?: (files: File[]) => void;
  className?: string;
  activeTemplateName?: string | null;
  onSaveAsTemplate?: () => void | Promise<void>;
  onEditTemplate?: () => void | Promise<void>;
  onDuplicateTemplate?: () => void | Promise<void>;
  onArchiveTemplate?: () => void | Promise<void>;
}

export function SubtasksSection({
  subtasks,
  onSubtasksChange,
  showDescription = true,
  embedded = false,
  description = "",
  onDescriptionChange,
  onPasteImages,
  activeTemplateName,
  onSaveAsTemplate,
  onEditTemplate,
  onDuplicateTemplate,
  onArchiveTemplate,
  className
}: SubtasksSectionProps) {
  const navigate = useNavigate();
  const [descriptionFocused, setDescriptionFocused] = useState(false);

  const handleAddFirstSubtask = () => {
    if (subtasks.length === 0) {
      const newSubtask: SubtaskInput = {
        id: crypto.randomUUID(),
        title: "",
        is_yes_no: false,
        requires_signature: false,
        step_type: "check",
      };
      onSubtasksChange([newSubtask]);
    }
  };

  const handleReorder = (ids: string[]) => {
    // TODO: persist reorder to order_index in the database
    void ids;
  };

  // If no subtasks, show the "add subtask" placeholder row
  const showPlaceholder = subtasks.length === 0;

  // Reveal checklist chrome once the user starts writing (or already has steps).
  // When showDescription is false, the parent already gated mounting (e.g. Intake) — keep chrome on.
  const hasDescriptionContent = Boolean(description.trim());
  const revealChecklistChrome =
    !showDescription ||
    hasDescriptionContent ||
    descriptionFocused ||
    subtasks.length > 0;

  return (
    <div
      className={cn(
        "group/subtask overflow-hidden text-white",
        embedded ? "mt-0 rounded-none bg-transparent shadow-none" : "shadow-engraved rounded-xl bg-white/80 mt-4",
        className
      )}
      style={{
        backgroundClip: "unset",
        WebkitBackgroundClip: "unset",
        backgroundImage: "none",
        paddingTop: "0px",
      }}
    >
      {/* Description Area */}
      {showDescription && (
        <div
          className="pt-3 pb-3 bg-black/0 min-h-[80px]"
          style={{ paddingLeft: "15px", paddingRight: "15px" }}
          {...(onPasteImages ? fileDropBind(onPasteImages) : {})}
        >
          <Textarea
            placeholder="What Needs Doing?"
            value={description}
            onChange={(e) => onDescriptionChange?.(e.target.value)}
            onFocus={() => setDescriptionFocused(true)}
            onBlur={() => setDescriptionFocused(false)}
            onPaste={(e) => {
              if (!onPasteImages) return;
              const files = clipboardImageFiles(e.clipboardData);
              if (files.length === 0) return;
              e.preventDefault();
              onPasteImages(files);
            }}
            rows={2}
            className="box-content border-0 bg-transparent shadow-none focus-visible:ring-0 p-0 text-[17px] font-normal text-foreground placeholder:text-muted-foreground/60 resize-none"
            style={{ fontFamily: '"Inter Tight"', boxShadow: "none" }}
          />
        </div>
      )}

      {/* Subtasks Area */}
      <div className="pl-0 pr-0 pb-[6px] pt-0">
        {showPlaceholder ? (
          <div
            className={cn(
              "flex items-center gap-2 py-[3px] pl-[13px] cursor-pointer group transition-opacity duration-200",
              !revealChecklistChrome && "opacity-0 hover:opacity-100"
            )}
            onClick={handleAddFirstSubtask}
          >
            <div
              className={cn(
                "h-3 w-3 rounded-lg border-2 border-muted-foreground/20 bg-background/50 transition-opacity",
                !revealChecklistChrome && "opacity-0 group-hover:opacity-100"
              )}
            />
            <span
              className={cn(
                "flex-1 text-muted-foreground/50 text-sm transition-opacity",
                !revealChecklistChrome && "opacity-0 group-hover:opacity-100"
              )}
            >
              Add step
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7 transition-opacity",
                    !revealChecklistChrome && "opacity-0 group-hover:opacity-100"
                  )}
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border shadow-e2">
                <DropdownMenuItem onClick={handleAddFirstSubtask}>
                  Add Step
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <SubtaskList
            subtasks={subtasks}
            isCreator={true}
            onSubtasksChange={onSubtasksChange}
            onReorder={handleReorder}
          />
        )}

        {activeTemplateName && (
          <div className="pt-2 text-center text-caption text-muted-foreground/70">
            Template: <span className="font-medium text-foreground/80">{activeTemplateName}</span>
          </div>
        )}

        {!activeTemplateName ? (
          <div
            className={cn(
              "flex items-center justify-end gap-[5px] pt-[3px] mt-1 pr-[10px] pb-1 text-xs text-muted-foreground/60 transition-opacity duration-200",
              revealChecklistChrome
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none md:group-hover/subtask:opacity-100 md:group-hover/subtask:pointer-events-auto md:group-focus-within/subtask:opacity-100 md:group-focus-within/subtask:pointer-events-auto"
            )}
          >
            <button
              type="button"
              className="hover:text-muted-foreground transition-colors"
              onClick={(e) => {
                e.preventDefault();
                onSaveAsTemplate?.();
              }}
            >
              Save Checklist
            </button>
            <span className="text-muted-foreground/30">|</span>
            <button
              type="button"
              className="hover:text-muted-foreground transition-colors"
              onClick={(e) => {
                e.preventDefault();
                navigate("/manage/templates");
              }}
            >
              Templates
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-4 pt-2 mt-1 text-xs text-muted-foreground/60">
            <button
              type="button"
              className="hover:text-muted-foreground transition-colors"
              onClick={(e) => {
                e.preventDefault();
                onEditTemplate?.();
              }}
            >
              Edit Template
            </button>
            <span className="text-muted-foreground/30">|</span>
            <button
              type="button"
              className="hover:text-muted-foreground transition-colors"
              onClick={(e) => {
                e.preventDefault();
                onDuplicateTemplate?.();
              }}
            >
              Duplicate
            </button>
            <span className="text-muted-foreground/30">|</span>
            <button
              type="button"
              className="hover:text-muted-foreground transition-colors"
              onClick={(e) => {
                e.preventDefault();
                onArchiveTemplate?.();
              }}
            >
              Archive
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
