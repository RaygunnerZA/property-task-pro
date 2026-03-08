import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  FileStack,
  Plus,
  MoreHorizontal,
  Pencil,
  Copy,
  Archive,
  CheckSquare,
  FileSignature,
  Sparkles,
} from "lucide-react";
import { StandardPage } from "@/components/design-system/StandardPage";
import { FilterChip } from "@/components/chips/filter/Chip";
import { FilterRow } from "@/components/filla/FilterRow";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import {
  useChecklistTemplates,
  type ChecklistTemplate,
  type ChecklistTemplateCategory,
} from "@/hooks/useChecklistTemplates";
import {
  saveTemplate,
  updateTemplate,
  archiveTemplate,
  duplicateTemplate,
  normalizeItems,
} from "@/services/templates/templateService";
import { TemplateDialog, CATEGORY_OPTIONS, type TemplateDialogValue } from "@/components/templates/TemplateDialog";
import { PresetBrowser } from "@/components/templates/PresetBrowser";
import { PRESET_TEMPLATES, type PresetTemplate } from "@/data/presetTemplates";
import { supabase } from "@/integrations/supabase/client";
import type { SubtaskData } from "@/components/tasks/subtasks";

const FILTER_OPTIONS: Array<{ id: "all" | ChecklistTemplateCategory; label: string }> = [
  { id: "all", label: "All" },
  ...CATEGORY_OPTIONS.map((o) => ({ id: o.value, label: o.label })),
];

const CATEGORY_COLORS: Record<ChecklistTemplateCategory, string> = {
  compliance: "#8EC9CE",
  maintenance: "#f5a623",
  security: "#EB6834",
  operations: "#9b8ea8",
};

const CATEGORY_BG: Record<ChecklistTemplateCategory, string> = {
  compliance: "bg-[#8EC9CE]/10 text-[#5aa3a9]",
  maintenance: "bg-amber-100 text-amber-700",
  security: "bg-[#EB6834]/10 text-[#EB6834]",
  operations: "bg-purple-100 text-purple-600",
};

function parseItems(raw: unknown): SubtaskData[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") {
        return item.trim()
          ? { id: crypto.randomUUID(), title: item.trim(), is_yes_no: false, requires_signature: false }
          : null;
      }
      if (item && typeof item === "object") {
        const { title = "", label = "", is_yes_no = false, requires_signature = false } = item as Record<string, unknown>;
        const t = ((title as string) || (label as string) || "").trim();
        return t
          ? { id: crypto.randomUUID(), title: t, is_yes_no: Boolean(is_yes_no), requires_signature: Boolean(requires_signature) }
          : null;
      }
      return null;
    })
    .filter((i): i is SubtaskData => i !== null);
}

interface TemplateCardProps {
  template: ChecklistTemplate;
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
}

function TemplateCard({ template, onEdit, onDuplicate, onArchive }: TemplateCardProps) {
  const rawItems = Array.isArray(template.items) ? template.items : [];
  const itemCount = (rawItems as unknown[]).filter((i) => {
    if (typeof i === "string") return (i as string).trim().length > 0;
    if (i && typeof i === "object") return Boolean((i as Record<string, unknown>).title || (i as Record<string, unknown>).label);
    return false;
  }).length;

  const hasYesNo = (rawItems as unknown[]).some(
    (i) => i && typeof i === "object" && (i as Record<string, unknown>).is_yes_no
  );
  const hasSig = (rawItems as unknown[]).some(
    (i) => i && typeof i === "object" && (i as Record<string, unknown>).requires_signature
  );

  return (
    <div className="group relative bg-card rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-[2px] px-5 py-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate leading-snug">
            {template.name}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="h-7 w-7 rounded-lg grid place-items-center text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0"
              aria-label="Template options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card border-0 shadow-e3 rounded-xl w-40">
            <DropdownMenuItem onClick={onEdit} className="gap-2 text-sm cursor-pointer">
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate} className="gap-2 text-sm cursor-pointer">
              <Copy className="h-3.5 w-3.5" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onArchive}
              className="gap-2 text-sm cursor-pointer text-[#EB6834] focus:text-[#EB6834] focus:bg-[#EB6834]/10"
            >
              <Archive className="h-3.5 w-3.5" />
              Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wide ${CATEGORY_BG[template.category]}`}
        >
          {template.category}
        </span>
        <span className="text-[11px] text-muted-foreground/60">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
        {hasYesNo && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/50" title="Contains yes/no items">
            <CheckSquare className="h-3 w-3" />
          </span>
        )}
        {hasSig && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/50" title="Contains signature items">
            <FileSignature className="h-3 w-3" />
          </span>
        )}
      </div>
    </div>
  );
}

type DialogState =
  | { mode: "create" }
  | { mode: "edit"; template: ChecklistTemplate }
  | null;

export default function ManageTemplates() {
  const { orgId } = useActiveOrg();
  const { toast } = useToast();
  const { templates, loading, refresh } = useChecklistTemplates(true);

  const [activeFilter, setActiveFilter] = useState<"all" | ChecklistTemplateCategory>("all");
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [presetBrowserOpen, setPresetBrowserOpen] = useState(false);

  // Track which preset IDs have already been added by the user this session
  const [addedPresetIds, setAddedPresetIds] = useState<Set<string>>(new Set());
  const [addingPresetId, setAddingPresetId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const seedAttemptedRef = useRef(false);

  // Auto-seed all preset templates on first visit (once per org, tracked in localStorage)
  useEffect(() => {
    if (loading || !orgId || templates.length > 0 || seedAttemptedRef.current) return;

    const storageKey = `filla-presets-seeded:${orgId}`;
    if (localStorage.getItem(storageKey)) return;

    seedAttemptedRef.current = true;
    setSeeding(true);

    const rows = PRESET_TEMPLATES.map((p) => ({
      org_id: orgId,
      name: p.name,
      category: p.category,
      items: p.items,
    }));

    supabase
      .from("checklist_templates")
      .insert(rows)
      .then(({ error }) => {
        setSeeding(false);
        if (!error) {
          localStorage.setItem(storageKey, "1");
          refresh();
        }
      });
  }, [loading, orgId, templates.length, refresh]);

  const filtered = useMemo(() => {
    if (activeFilter === "all") return templates;
    return templates.filter((t) => t.category === activeFilter);
  }, [templates, activeFilter]);

  const grouped = useMemo(() => {
    if (activeFilter !== "all") return null;
    const map = new Map<ChecklistTemplateCategory, ChecklistTemplate[]>();
    for (const opt of CATEGORY_OPTIONS) {
      const items = templates.filter((t) => t.category === opt.value);
      if (items.length > 0) map.set(opt.value, items);
    }
    return map;
  }, [templates, activeFilter]);

  const openCreate = () => setDialogState({ mode: "create" });
  const openEdit = (template: ChecklistTemplate) => setDialogState({ mode: "edit", template });

  const handleDialogSubmit = async (value: TemplateDialogValue) => {
    if (!orgId) return;
    setSubmitting(true);

    const normalizedItems = normalizeItems(
      value.items.map((i) => ({
        title: i.title,
        is_yes_no: i.is_yes_no,
        requires_signature: i.requires_signature,
      }))
    );

    try {
      if (dialogState?.mode === "edit") {
        const { error } = await updateTemplate({
          orgId,
          templateId: dialogState.template.id,
          name: value.name,
          category: value.category,
          items: normalizedItems,
        });
        if (error) throw error;
        toast({ title: "Template updated", description: `"${value.name}" has been updated.` });
      } else {
        const { error } = await saveTemplate({
          orgId,
          name: value.name,
          category: value.category,
          items: normalizedItems,
        });
        if (error) throw error;
        toast({ title: "Template created", description: `"${value.name}" is now available.` });
      }

      await refresh();
      setDialogState(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: "Something went wrong", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDuplicate = async (template: ChecklistTemplate) => {
    if (!orgId) return;
    const items = normalizeItems(parseItems(template.items));
    const { error } = await duplicateTemplate(
      orgId,
      template.id,
      `${template.name} Copy`,
      items,
      template.category
    );
    if (error) {
      toast({ title: "Couldn't duplicate", description: error.message, variant: "destructive" });
      return;
    }
    await refresh();
    toast({ title: "Template duplicated", description: `"${template.name} Copy" created.` });
  };

  const handleArchive = async (template: ChecklistTemplate) => {
    if (!orgId) return;
    const confirmed = window.confirm(
      `Archive "${template.name}"? It will be removed from the checklist picker.`
    );
    if (!confirmed) return;

    const { error } = await archiveTemplate(orgId, template.id);
    if (error) {
      toast({ title: "Couldn't archive", description: error.message, variant: "destructive" });
      return;
    }
    await refresh();
    toast({ title: "Template archived", description: `"${template.name}" has been archived.` });
  };

  const handleAddPreset = useCallback(
    async (preset: PresetTemplate) => {
      if (!orgId || addedPresetIds.has(preset.id)) return;
      setAddingPresetId(preset.id);

      const { error } = await saveTemplate({
        orgId,
        name: preset.name,
        category: preset.category,
        items: preset.items,
      });

      setAddingPresetId(null);

      if (error) {
        toast({ title: "Couldn't add template", description: error.message, variant: "destructive" });
        return;
      }

      setAddedPresetIds((prev) => new Set([...prev, preset.id]));
      await refresh();
      toast({
        title: "Template added",
        description: `"${preset.name}" is now in your library.`,
      });
    },
    [orgId, addedPresetIds, refresh, toast]
  );

  const dialogInitialValue: Partial<TemplateDialogValue> | undefined = useMemo(() => {
    if (!dialogState || dialogState.mode === "create") return undefined;
    return {
      name: dialogState.template.name,
      category: dialogState.template.category,
      items: parseItems(dialogState.template.items),
    };
  }, [dialogState]);

  const headerActions = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setPresetBrowserOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground bg-card shadow-sm hover:shadow-md hover:-translate-y-[1px] transition-all active:scale-[0.98]"
      >
        <Sparkles className="h-4 w-4 text-[#8EC9CE]" />
        Starters
      </button>
      <button
        type="button"
        onClick={openCreate}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#8EC9CE] hover:brightness-105 transition-all shadow-md active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" />
        New
      </button>
    </div>
  );

  return (
    <StandardPage
      title="Templates"
      icon={<FileStack className="h-6 w-6" />}
      maxWidth="lg"
      action={headerActions}
    >
      {/* Category filter row */}
      {templates.length > 0 && (
        <FilterRow className="mb-6">
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
      )}

      {/* Loading / seeding skeleton */}
      {(loading || seeding) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-[88px] rounded-2xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state — only shown when not seeding and truly empty */}
      {!loading && !seeding && templates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
          <div className="h-16 w-16 rounded-2xl bg-[#8EC9CE]/10 grid place-items-center">
            <FileStack className="h-8 w-8 text-[#8EC9CE]" />
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">No templates yet</p>
            <p className="text-sm text-muted-foreground/70 max-w-xs">
              Save reusable checklists to speed up task creation, or browse our ready-made starters.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPresetBrowserOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#5aa3a9] bg-[#8EC9CE]/10 hover:bg-[#8EC9CE]/20 transition-all"
            >
              <Sparkles className="h-4 w-4" />
              Browse Starters
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#8EC9CE] shadow-md hover:brightness-105 transition-all active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              Create from Scratch
            </button>
          </div>
        </div>
      )}

      {/* Templates — grouped by category when "All" is selected */}
      {!loading && !seeding && templates.length > 0 && activeFilter === "all" && grouped && (
        <div className="space-y-8">
          {Array.from(grouped.entries()).map(([cat, items]) => (
            <section key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono uppercase tracking-wider ${CATEGORY_BG[cat]}`}
                >
                  {cat}
                </span>
                <span className="text-xs text-muted-foreground/50">{items.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((t) => (
                  <TemplateCard
                    key={t.id}
                    template={t}
                    onEdit={() => openEdit(t)}
                    onDuplicate={() => handleDuplicate(t)}
                    onArchive={() => handleArchive(t)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Templates — flat list when a specific category is selected */}
      {!loading && !seeding && templates.length > 0 && activeFilter !== "all" && (
        <>
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground/60 text-sm">
              No templates in this category yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onEdit={() => openEdit(t)}
                  onDuplicate={() => handleDuplicate(t)}
                  onArchive={() => handleArchive(t)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Create / Edit dialog */}
      <TemplateDialog
        open={dialogState !== null}
        onOpenChange={(v) => { if (!v) setDialogState(null); }}
        mode={dialogState?.mode ?? "create"}
        initialValue={dialogInitialValue}
        onSubmit={handleDialogSubmit}
        loading={submitting}
      />

      {/* Preset browser sheet */}
      <PresetBrowser
        open={presetBrowserOpen}
        onOpenChange={setPresetBrowserOpen}
        addedPresetIds={addedPresetIds}
        addingPresetId={addingPresetId}
        onAddPreset={handleAddPreset}
      />
    </StandardPage>
  );
}
