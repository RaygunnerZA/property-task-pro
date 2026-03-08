import { useState, useMemo } from "react";
import { Search, CheckSquare, FileSignature, ChevronRight, Sparkles } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FilterChip } from "@/components/chips/filter/Chip";
import { FilterRow } from "@/components/filla/FilterRow";
import { cn } from "@/lib/utils";
import { PRESET_TEMPLATES, PRESET_BY_CATEGORY, type PresetTemplate } from "@/data/presetTemplates";
import type { ChecklistTemplateCategory } from "@/hooks/useChecklistTemplates";
import { CATEGORY_OPTIONS } from "@/components/templates/TemplateDialog";

const FILTER_OPTIONS: Array<{ id: "all" | ChecklistTemplateCategory; label: string }> = [
  { id: "all", label: "All" },
  ...CATEGORY_OPTIONS.map((o) => ({ id: o.value, label: o.label })),
];

const CATEGORY_BG: Record<ChecklistTemplateCategory, string> = {
  compliance: "bg-[#8EC9CE]/10 text-[#5aa3a9]",
  maintenance: "bg-amber-100 text-amber-700",
  security: "bg-[#EB6834]/10 text-[#EB6834]",
  operations: "bg-purple-100 text-purple-600",
};

const CATEGORY_COLORS: Record<ChecklistTemplateCategory, string> = {
  compliance: "#8EC9CE",
  maintenance: "#f5a623",
  security: "#EB6834",
  operations: "#9b8ea8",
};

interface PresetCardProps {
  preset: PresetTemplate;
  isAdded: boolean;
  isAdding: boolean;
  onAdd: (preset: PresetTemplate) => void;
}

function PresetCard({ preset, isAdded, isAdding, onAdd }: PresetCardProps) {
  const yesNoCount = preset.items.filter((i) => i.is_yes_no).length;
  const sigCount = preset.items.filter((i) => i.requires_signature).length;

  return (
    <div
      className={cn(
        "group relative rounded-2xl px-4 py-3.5 flex flex-col gap-2 transition-all duration-200",
        isAdded
          ? "bg-[#8EC9CE]/8 shadow-sm"
          : "bg-card shadow-md hover:shadow-lg hover:-translate-y-[1px]"
      )}
    >
      {/* Name + add button */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground leading-snug">
            {preset.name}
          </p>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5 leading-relaxed">
            {preset.description}
          </p>
        </div>

        <button
          type="button"
          onClick={() => !isAdded && onAdd(preset)}
          disabled={isAdded || isAdding}
          className={cn(
            "shrink-0 mt-0.5 h-7 rounded-lg px-2.5 text-[11px] font-semibold transition-all duration-150",
            isAdded
              ? "bg-[#8EC9CE]/20 text-[#5aa3a9] cursor-default"
              : isAdding
                ? "bg-muted text-muted-foreground cursor-wait"
                : "bg-[#8EC9CE] text-white shadow-sm hover:brightness-105 active:scale-[0.97]"
          )}
        >
          {isAdded ? "Added" : isAdding ? "Adding…" : "Add"}
        </button>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wide ${CATEGORY_BG[preset.category]}`}
        >
          {preset.category}
        </span>
        <span className="text-[11px] text-muted-foreground/50">
          {preset.items.length} items
        </span>
        {yesNoCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/40" title="Contains yes/no items">
            <CheckSquare className="h-3 w-3" />
            {yesNoCount}
          </span>
        )}
        {sigCount > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/40" title="Contains signature items">
            <FileSignature className="h-3 w-3" />
            {sigCount}
          </span>
        )}
      </div>
    </div>
  );
}

interface PresetBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addedPresetIds: Set<string>;
  addingPresetId: string | null;
  onAddPreset: (preset: PresetTemplate) => void;
}

export function PresetBrowser({
  open,
  onOpenChange,
  addedPresetIds,
  addingPresetId,
  onAddPreset,
}: PresetBrowserProps) {
  const [activeFilter, setActiveFilter] = useState<"all" | ChecklistTemplateCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    let pool = PRESET_TEMPLATES;
    if (activeFilter !== "all") pool = PRESET_BY_CATEGORY[activeFilter];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      pool = pool.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.category.includes(q)
      );
    }
    return pool;
  }, [activeFilter, searchQuery]);

  // Group by category when "all" is selected and no search
  const showGrouped = activeFilter === "all" && !searchQuery.trim();

  const grouped = useMemo(() => {
    if (!showGrouped) return null;
    return CATEGORY_OPTIONS.map((opt) => ({
      category: opt.value,
      label: opt.label,
      items: PRESET_BY_CATEGORY[opt.value],
    }));
  }, [showGrouped]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg bg-background border-l-0 shadow-e3 flex flex-col p-0 overflow-hidden"
      >
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-0 shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-[#8EC9CE]" />
            <SheetTitle className="text-base font-semibold">Starter Templates</SheetTitle>
          </div>
          <p className="text-xs text-muted-foreground/70 leading-relaxed">
            Ready-made checklists for UK property management. Add any to your library in one click.
          </p>
        </SheetHeader>

        {/* Search */}
        <div className="px-5 pt-3 pb-2 shrink-0">
          <div className="flex items-center gap-2 h-9 px-3 rounded-xl bg-card shadow-engraved">
            <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates…"
              className="flex-1 bg-transparent border-0 outline-none text-sm text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        {/* Category filter */}
        <div className="px-5 pb-3 shrink-0">
          <FilterRow>
            {FILTER_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.id}
                label={opt.label}
                selected={activeFilter === opt.id}
                color={opt.id !== "all" ? CATEGORY_COLORS[opt.id as ChecklistTemplateCategory] : undefined}
                onSelect={() => setActiveFilter(opt.id)}
                className="h-[28px]"
              />
            ))}
          </FilterRow>
        </div>

        {/* Template list */}
        <div className="flex-1 overflow-y-auto px-5 pb-8 space-y-6">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground/60 text-center pt-8">
              No templates match your search.
            </p>
          )}

          {showGrouped && grouped
            ? grouped.map(({ category, label, items }) =>
                items.length === 0 ? null : (
                  <section key={category}>
                    <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-1 z-10">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono uppercase tracking-wider ${CATEGORY_BG[category as ChecklistTemplateCategory]}`}
                      >
                        {label}
                      </span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
                      <span className="text-xs text-muted-foreground/40">{items.length}</span>
                    </div>
                    <div className="space-y-3">
                      {items.map((preset) => (
                        <PresetCard
                          key={preset.id}
                          preset={preset}
                          isAdded={addedPresetIds.has(preset.id)}
                          isAdding={addingPresetId === preset.id}
                          onAdd={onAddPreset}
                        />
                      ))}
                    </div>
                  </section>
                )
              )
            : filtered.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  isAdded={addedPresetIds.has(preset.id)}
                  isAdding={addingPresetId === preset.id}
                  onAdd={onAddPreset}
                />
              ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
