import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, MoreHorizontal, Search } from "lucide-react";
import { FilterChip } from "@/components/chips/filter";
import { FilterRow } from "@/components/filla/FilterRow";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SubtaskList, SubtaskData } from "../subtasks";
import type { ChecklistTemplate, ChecklistTemplateCategory } from "@/hooks/useChecklistTemplates";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

// Re-export for backwards compatibility
export type SubtaskInput = SubtaskData;

const CATEGORY_OPTIONS: Array<{ id: "all" | ChecklistTemplateCategory; label: string }> = [
  { id: "all", label: "All" },
  { id: "compliance", label: "Compliance" },
  { id: "maintenance", label: "Maintenance" },
  { id: "security", label: "Security" },
  { id: "operations", label: "Operations" },
];

interface SubtasksSectionProps {
  subtasks: SubtaskInput[];
  onSubtasksChange: (subtasks: SubtaskInput[]) => void;
  description?: string;
  onDescriptionChange?: (description: string) => void;
  className?: string;
  templates?: ChecklistTemplate[];
  recentTemplateIds?: string[];
  activeTemplateName?: string | null;
  onUseTemplate?: (templateId: string) => void;
  onSaveAsTemplate?: () => void | Promise<void>;
  onEditTemplate?: () => void | Promise<void>;
  onDuplicateTemplate?: () => void | Promise<void>;
  onArchiveTemplate?: () => void | Promise<void>;
}
export function SubtasksSection({
  subtasks,
  onSubtasksChange,
  description = "",
  onDescriptionChange,
  templates = [],
  recentTemplateIds = [],
  activeTemplateName,
  onUseTemplate,
  onSaveAsTemplate,
  onEditTemplate,
  onDuplicateTemplate,
  onArchiveTemplate,
  className
}: SubtasksSectionProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerView, setPickerView] = useState<"root" | "recent" | "categories" | "category-options" | "search">("root");
  const [animationDirection, setAnimationDirection] = useState<"left-to-right" | "right-to-left" | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<"all" | ChecklistTemplateCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const handleAddFirstSubtask = () => {
    if (subtasks.length === 0) {
      const newSubtask: SubtaskInput = {
        id: crypto.randomUUID(),
        title: "",
        is_yes_no: false,
        requires_signature: false
      };
      onSubtasksChange([newSubtask]);
    }
  };

  const handleReorder = (ids: string[]) => {
    // This callback can be used to update order_index in the database
    console.log("Reordered subtasks:", ids);
  };

  // If no subtasks, show the "add subtask" placeholder row
  const showPlaceholder = subtasks.length === 0;

  const templateMap = useMemo(() => {
    return new Map(templates.map((template) => [template.id, template]));
  }, [templates]);

  const recentTemplates = useMemo(() => {
    return recentTemplateIds
      .map((id) => templateMap.get(id))
      .filter((template): template is ChecklistTemplate => Boolean(template))
      .slice(0, 8);
  }, [recentTemplateIds, templateMap]);

  const categoryTemplates = useMemo(() => {
    if (selectedCategory === "all") return templates;
    return templates.filter((template) => template.category === selectedCategory);
  }, [selectedCategory, templates]);

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return templates.filter((template) => template.name.toLowerCase().includes(query));
  }, [searchQuery, templates]);

  const closePicker = () => {
    setAnimationDirection("right-to-left");
    setTimeout(() => {
      setPickerOpen(false);
      setPickerView("root");
      setSearchQuery("");
    }, 120);
  };

  useEffect(() => {
    if (!animationDirection) return;
    const timer = window.setTimeout(() => setAnimationDirection(null), 280);
    return () => window.clearTimeout(timer);
  }, [animationDirection]);

  const getAnimationClass = () => {
    if (!animationDirection) return "";
    return animationDirection === "right-to-left"
      ? "animate-wipe-right-to-left"
      : "animate-wipe-left-to-right";
  };

  const renderTemplateChips = (items: ChecklistTemplate[], emptyLabel: string) => {
    if (items.length === 0) {
      return (
        <div className="text-[11px] text-muted-foreground/70 px-2 py-1 whitespace-nowrap">
          {emptyLabel}
        </div>
      );
    }

    return (
      <FilterRow className="py-1">
        {items.map((template) => (
          <FilterChip
            key={template.id}
            label={template.name}
            className="h-[28px]"
            onSelect={() => {
              onUseTemplate?.(template.id);
              closePicker();
            }}
          />
        ))}
      </FilterRow>
    );
  };

  const openChildView = (view: "recent" | "categories" | "search") => {
    setAnimationDirection("left-to-right");
    setPickerView(view);
  };

  const handleBack = () => {
    setAnimationDirection("right-to-left");
    if (pickerView === "category-options") {
      setPickerView("categories");
      return;
    }
    setPickerView("root");
  };

  return <div 
      className={cn("shadow-engraved rounded-xl overflow-hidden text-white bg-white/80 mt-4", className)}
      style={{
        backgroundClip: 'unset',
        WebkitBackgroundClip: 'unset',
        backgroundImage: 'none',
        paddingTop: '0px'
      }}
    >
      {/* Description Area */}
      <div className="pt-3 pb-3 bg-black/0 h-[62px]" style={{ paddingLeft: '15px', paddingRight: '15px' }}>
        <Textarea placeholder="What needs doing?" value={description} onChange={e => onDescriptionChange?.(e.target.value)} rows={2} className="box-content border-0 bg-transparent shadow-none focus-visible:ring-0 p-0 text-base font-normal text-foreground placeholder:text-muted-foreground/60 resize-none min-h-[80px]" style={{ fontFamily: '"Inter Tight"', boxShadow: 'none' }} />
      </div>

      {/* Subtasks Area */}
      <div className="px-4 pb-[3px] pt-0">
        {showPlaceholder ? (/* Empty State - Add Subtask Placeholder */
      <div className="flex items-center gap-2 py-1 cursor-pointer group" onClick={handleAddFirstSubtask}>
            <div className="h-3 w-3 rounded-lg border-2 border-muted-foreground/20 bg-background/50" />
            <span className="flex-1 text-muted-foreground/50 text-sm">
              Add subtask
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
              </DropdownMenuContent>
            </DropdownMenu>
          </div>) : (
          <>
            {/* Subtask List with DnD */}
            <SubtaskList subtasks={subtasks} isCreator={true} onSubtasksChange={onSubtasksChange} onReorder={handleReorder} />
          </>
        )}

        {activeTemplateName && (
          <div className="pt-2 text-center text-[11px] text-muted-foreground/70">
            Template: <span className="font-medium text-foreground/80">{activeTemplateName}</span>
          </div>
        )}

        {!activeTemplateName ? (
          <div className="flex items-center justify-center gap-4 pt-2 mt-1 text-xs text-muted-foreground/60">
            <button
              type="button"
              className="hover:text-muted-foreground transition-colors"
              onClick={(e) => {
                e.preventDefault();
                setPickerOpen((prev) => !prev);
              }}
            >
              Use Checklist
            </button>
            <span className="text-muted-foreground/30">|</span>
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

        {pickerOpen && (
          <div className="mt-2 -mx-4 px-4 py-2 animate-fade-in">
            <div
              key={`${pickerView}-${selectedCategory}-${searchQuery.length > 0 ? "q" : "nq"}`}
              className={cn("flex items-center gap-2 overflow-x-auto no-scrollbar", getAnimationClass())}
            >
              {pickerView === "root" && (
                <>
                  <FilterChip
                    label="Recent"
                    onSelect={() => openChildView("recent")}
                    className="h-[28px]"
                  />
                  <FilterChip
                    label="Categories"
                    onSelect={() => openChildView("categories")}
                    className="h-[28px]"
                  />
                  <FilterChip
                    label="Search"
                    onSelect={() => openChildView("search")}
                    className="h-[28px]"
                  />
                </>
              )}

              {pickerView !== "root" && (
                <button
                  type="button"
                  className="h-[28px] w-[28px] rounded-[8px] grid place-items-center bg-background shadow-[1px_2px_2px_0px_rgba(0,0,0,0.15),-2px_-2px_2px_0px_rgba(255,255,255,0.7)] shrink-0"
                  onClick={handleBack}
                  aria-label="Back"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}

              {pickerView === "recent" && renderTemplateChips(recentTemplates, "No recent checklists yet")}

              {pickerView === "categories" && (
                <FilterRow className="py-1">
                  {CATEGORY_OPTIONS.map((option) => (
                    <FilterChip
                      key={option.id}
                      label={option.label}
                      selected={selectedCategory === option.id}
                      className="h-[28px]"
                      onSelect={() => {
                        setSelectedCategory(option.id);
                        setAnimationDirection("left-to-right");
                        setPickerView("category-options");
                      }}
                    />
                  ))}
                </FilterRow>
              )}

              {pickerView === "category-options" &&
                renderTemplateChips(
                  categoryTemplates,
                  selectedCategory === "all" ? "No checklists yet" : "No checklists here yet"
                )}

              {pickerView === "search" && (
                <div className="h-9 min-w-[220px] px-3 rounded-[10px] bg-background shadow-engraved flex items-center gap-2">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search checklist templates"
                    className="w-full bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground/60"
                  />
                </div>
              )}
            </div>

            {pickerView === "search" && (
              <div className={cn("mt-1", getAnimationClass())}>
                {renderTemplateChips(searchResults, searchQuery ? "No matching checklists" : "Type to search templates")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>;
}