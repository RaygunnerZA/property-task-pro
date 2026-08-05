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
import { PresetBrowser, PresetPreviewDialog } from "@/components/templates/PresetBrowser";
import { StarterTemplateDisclaimerDialog } from "@/components/templates/StarterTemplateDisclaimerDialog";
import { TemplateAddedDialog } from "@/components/templates/TemplateAddedDialog";
import { RegulatedAreaBadge } from "@/components/templates/StarterTemplateCallout";
import { useOrgStarterDisclaimer } from "@/hooks/useOrgStarterDisclaimer";
import {
  PRESET_TEMPLATES,
  type PresetTemplate,
  type ManageTemplateEntry,
  getPresetIdsInLibrary,
  findLibraryTemplateForPreset,
  findPresetByName,
  buildManageTemplateEntries,
  getManageTemplateEntryKey,
  getManageTemplateEntryCategory,
  isRegulatedStarterPreset,
} from "@/data/presetTemplates";
import type { SubtaskData } from "@/components/tasks/subtasks";
import { parseChecklistTemplateItems } from "@/lib/checklistTemplateItems";

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
  compliance: "bg-primary/10 text-primary-deep",
  maintenance: "bg-warning/50 text-warning-foreground",
  security: "bg-accent/10 text-accent",
  operations: "bg-purple-100 text-purple-600",
};

function parseItems(raw: unknown): SubtaskData[] {
  return parseChecklistTemplateItems(raw);
}

interface TemplateCardProps {
  entry: ManageTemplateEntry;
  onOpen: () => void;
  onDuplicate?: () => void;
  onArchive?: () => void;
}

function TemplateCard({ entry, onOpen, onDuplicate, onArchive }: TemplateCardProps) {
  const isStarter = entry.kind === "preset" || entry.isStarter;
  const isVirtual = entry.kind === "preset";
  const name = entry.kind === "preset" ? entry.preset.name : entry.template.name;
  const category = getManageTemplateEntryCategory(entry);
  const regulatedPreset =
    entry.kind === "preset" ? entry.preset : findPresetByName(name);
  const showRegulatedBadge = regulatedPreset ? isRegulatedStarterPreset(regulatedPreset) : false;
  const rawItems = Array.isArray(
    entry.kind === "preset" ? entry.preset.items : entry.template.items
  )
    ? ((entry.kind === "preset" ? entry.preset.items : entry.template.items) as unknown[])
    : [];
  const itemCount = rawItems.filter((i) => {
    if (typeof i === "string") return (i as string).trim().length > 0;
    if (i && typeof i === "object") return Boolean((i as Record<string, unknown>).title || (i as Record<string, unknown>).label);
    return false;
  }).length;

  const hasYesNo = rawItems.some(
    (i) => i && typeof i === "object" && (i as Record<string, unknown>).is_yes_no
  );
  const hasSig = rawItems.some(
    (i) => i && typeof i === "object" && (i as Record<string, unknown>).requires_signature
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`group relative rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-[2px] px-5 py-4 flex flex-col gap-3 cursor-pointer text-left w-full ${
        isVirtual ? "bg-primary/5" : "bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground truncate leading-snug">
            {name}
          </p>
          {isVirtual && (
            <p className="text-caption text-muted-foreground/60 mt-0.5 line-clamp-2 leading-relaxed">
              {entry.preset.description}
            </p>
          )}
        </div>

        {!isVirtual && onDuplicate && onArchive && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="h-7 w-7 rounded-lg grid place-items-center text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus:opacity-100 shrink-0"
              aria-label="Template options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card border-0 shadow-e3 rounded-xl w-40">
            <DropdownMenuItem onClick={onOpen} className="gap-2 text-sm cursor-pointer">
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
              className="gap-2 text-sm cursor-pointer text-accent focus:text-accent focus:bg-accent/10"
            >
              <Archive className="h-3.5 w-3.5" />
              Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {isStarter && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-2xs font-mono uppercase tracking-wider bg-primary/10 text-primary-deep">
            <Sparkles className="h-3 w-3" aria-hidden />
            Starting template
          </span>
        )}
        {showRegulatedBadge && <RegulatedAreaBadge />}
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-mono uppercase tracking-wider ${CATEGORY_BG[category]}`}
        >
          {category}
        </span>
        <span className="text-caption text-muted-foreground/60">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
        {hasYesNo && (
          <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground/50" title="Contains yes/no items">
            <CheckSquare className="h-3 w-3" />
          </span>
        )}
        {hasSig && (
          <span className="inline-flex items-center gap-1 text-2xs text-muted-foreground/50" title="Contains signature items">
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
  const [previewPreset, setPreviewPreset] = useState<PresetTemplate | null>(null);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [pendingPreset, setPendingPreset] = useState<PresetTemplate | null>(null);
  const [disclaimerSubmitting, setDisclaimerSubmitting] = useState(false);
  const [addedTemplateDialog, setAddedTemplateDialog] = useState<PresetTemplate | null>(null);

  const { hasAccepted, acceptDisclaimer } = useOrgStarterDisclaimer();

  // Track which preset IDs have already been added by the user this session
  const [addedPresetIds, setAddedPresetIds] = useState<Set<string>>(new Set());
  const [addingPresetId, setAddingPresetId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const seedAttemptedRef = useRef(false);
  const seedInFlightRef = useRef(false);
  const refreshRef = useRef(refresh);
  const toastRef = useRef(toast);
  refreshRef.current = refresh;
  toastRef.current = toast;

  // Auto-seed all preset templates on first visit (once per org, tracked in localStorage)
  useEffect(() => {
    if (loading || !orgId || templates.length > 0 || seedAttemptedRef.current || seedInFlightRef.current) {
      return;
    }

    const storageKey = `filla-presets-seeded:${orgId}`;
    const attemptedKey = `filla-presets-seed-attempted:${orgId}`;
    if (localStorage.getItem(storageKey) || localStorage.getItem(attemptedKey)) return;

    seedAttemptedRef.current = true;
    seedInFlightRef.current = true;
    localStorage.setItem(attemptedKey, "1");
    setSeeding(true);

    const seedPresets = async () => {
      for (const preset of PRESET_TEMPLATES) {
        const { error } = await saveTemplate({
          orgId,
          name: preset.name,
          category: preset.category,
          items: normalizeItems(preset.items),
        });
        if (error) {
          throw error;
        }
      }
    };

    void seedPresets()
      .then(() => {
        seedInFlightRef.current = false;
        setSeeding(false);
        localStorage.setItem(storageKey, "1");
        localStorage.removeItem(attemptedKey);
        void refreshRef.current();
      })
      .catch((error: unknown) => {
        seedInFlightRef.current = false;
        setSeeding(false);
        const message = error instanceof Error ? error.message : String(error);
        toastRef.current({
          title: "Couldn't load starting templates",
          description: message,
          variant: "destructive",
        });
      });
  }, [loading, orgId, templates.length]);

  const displayEntries = useMemo(
    () => buildManageTemplateEntries(templates),
    [templates]
  );

  const customTemplateCount = useMemo(
    () => displayEntries.filter((entry) => entry.kind === "library" && !entry.isStarter).length,
    [displayEntries]
  );

  const libraryPresetIds = useMemo(
    () => getPresetIdsInLibrary(templates.map((t) => t.name)),
    [templates]
  );

  const addedPresetIdsMerged = useMemo(() => {
    const merged = new Set(addedPresetIds);
    for (const id of libraryPresetIds) merged.add(id);
    return merged;
  }, [addedPresetIds, libraryPresetIds]);

  const filteredEntries = useMemo(() => {
    if (activeFilter === "all") return displayEntries;
    return displayEntries.filter((entry) => getManageTemplateEntryCategory(entry) === activeFilter);
  }, [displayEntries, activeFilter]);

  const groupedEntries = useMemo(() => {
    if (activeFilter !== "all") return null;
    const map = new Map<ChecklistTemplateCategory, ManageTemplateEntry[]>();
    for (const opt of CATEGORY_OPTIONS) {
      const items = displayEntries.filter(
        (entry) => getManageTemplateEntryCategory(entry) === opt.value
      );
      if (items.length > 0) map.set(opt.value, items);
    }
    return map;
  }, [displayEntries, activeFilter]);

  const openCreate = () => setDialogState({ mode: "create" });
  const openEdit = (template: ChecklistTemplate) => setDialogState({ mode: "edit", template });

  const handleDialogSubmit = async (value: TemplateDialogValue) => {
    if (!orgId) return;
    setSubmitting(true);

    const normalizedItems = normalizeItems(value.items);

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

  const openEntry = useCallback((entry: ManageTemplateEntry) => {
    if (entry.kind === "preset") {
      setPreviewPreset(entry.preset);
      return;
    }
    openEdit(entry.template as ChecklistTemplate);
  }, []);

  const handleAddPreset = useCallback(
    async (preset: PresetTemplate) => {
      if (!orgId || addedPresetIdsMerged.has(preset.id)) return;
      setAddingPresetId(preset.id);

      const { error } = await saveTemplate({
        orgId,
        name: preset.name,
        category: preset.category,
        items: normalizeItems(preset.items),
      });

      setAddingPresetId(null);

      if (error) {
        toast({ title: "Couldn't add template", description: error.message, variant: "destructive" });
        return;
      }

      setAddedPresetIds((prev) => new Set([...prev, preset.id]));
      setPreviewPreset(null);
      await refresh();
      setAddedTemplateDialog(preset);
    },
    [orgId, addedPresetIdsMerged, refresh, toast]
  );

  const requestAddPreset = useCallback(
    (preset: PresetTemplate) => {
      if (!orgId || addedPresetIdsMerged.has(preset.id)) return;
      if (!hasAccepted) {
        setPendingPreset(preset);
        setDisclaimerOpen(true);
        return;
      }
      void handleAddPreset(preset);
    },
    [orgId, addedPresetIdsMerged, hasAccepted, handleAddPreset]
  );

  const handleDisclaimerConfirm = useCallback(
    async (dontShowAgain: boolean) => {
      setDisclaimerSubmitting(true);
      if (dontShowAgain) {
        const { error } = await acceptDisclaimer(true);
        if (error) {
          setDisclaimerSubmitting(false);
          toast({
            title: "Couldn't save preference",
            description: error.message,
            variant: "destructive",
          });
          return;
        }
      }
      setDisclaimerSubmitting(false);
      setDisclaimerOpen(false);
      const preset = pendingPreset;
      setPendingPreset(null);
      if (preset) {
        void handleAddPreset(preset);
      }
    },
    [acceptDisclaimer, handleAddPreset, pendingPreset, toast]
  );

  const handleOpenAddedTemplate = useCallback(() => {
    if (!addedTemplateDialog) return;
    const match = findLibraryTemplateForPreset(addedTemplateDialog, templates);
    const full = match ? templates.find((t) => t.id === match.id) : undefined;
    if (full) {
      openEdit(full);
    }
    setAddedTemplateDialog(null);
  }, [addedTemplateDialog, templates]);

  const handleOpenLibraryPreset = useCallback(
    (preset: PresetTemplate) => {
      const match = findLibraryTemplateForPreset(preset, templates);
      if (!match) {
        toast({
          title: "Template not found",
          description: `"${preset.name}" isn't in your library yet. Add it first.`,
          variant: "destructive",
        });
        return;
      }
      const full = templates.find((t) => t.id === match.id);
      if (full) {
        setPresetBrowserOpen(false);
        setPreviewPreset(null);
        openEdit(full);
      }
    },
    [templates, toast]
  );

  const dialogInitialValue: Partial<TemplateDialogValue> | undefined = useMemo(() => {
    if (!dialogState || dialogState.mode === "create") return undefined;
    return {
      name: dialogState.template.name,
      category: dialogState.template.category,
      items: parseItems(dialogState.template.items),
    };
  }, [dialogState]);

  const editingStarterPreset = useMemo(() => {
    if (!dialogState || dialogState.mode !== "edit") return undefined;
    return findPresetByName(dialogState.template.name);
  }, [dialogState]);

  const headerActions = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setPresetBrowserOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground bg-card shadow-sm hover:shadow-md hover:-translate-y-[1px] transition-all active:scale-[0.98]"
      >
        <Sparkles className="h-4 w-4 text-primary" />
        Starting Templates
      </button>
      <button
        type="button"
        onClick={openCreate}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-primary-foreground bg-primary hover:brightness-105 transition-all shadow-md active:scale-[0.98]"
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

      {seeding && (
        <p className="mb-4 text-xs text-muted-foreground/70">
          Saving starting templates to your library…
        </p>
      )}

      {loading && customTemplateCount === 0 && !seeding && (
        <p className="mb-4 text-xs text-muted-foreground/50">Loading your custom templates…</p>
      )}

      {/* Templates — grouped by category when "All" is selected */}
      {activeFilter === "all" && groupedEntries && (
        <div className="space-y-8">
          {Array.from(groupedEntries.entries()).map(([cat, items]) => (
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
                {items.map((entry) => (
                  <TemplateCard
                    key={getManageTemplateEntryKey(entry)}
                    entry={entry}
                    onOpen={() => openEntry(entry)}
                    onDuplicate={
                      entry.kind === "library"
                        ? () => void handleDuplicate(entry.template as ChecklistTemplate)
                        : undefined
                    }
                    onArchive={
                      entry.kind === "library"
                        ? () => void handleArchive(entry.template as ChecklistTemplate)
                        : undefined
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Templates — flat list when a specific category is selected */}
      {activeFilter !== "all" && (
        <>
          {filteredEntries.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground/60 text-sm">
              No templates in this category yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredEntries.map((entry) => (
                <TemplateCard
                  key={getManageTemplateEntryKey(entry)}
                  entry={entry}
                  onOpen={() => openEntry(entry)}
                  onDuplicate={
                    entry.kind === "library"
                      ? () => void handleDuplicate(entry.template as ChecklistTemplate)
                      : undefined
                  }
                  onArchive={
                    entry.kind === "library"
                      ? () => void handleArchive(entry.template as ChecklistTemplate)
                      : undefined
                  }
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
        showStartingTemplateCallout={Boolean(editingStarterPreset)}
        isRegulatedArea={editingStarterPreset ? isRegulatedStarterPreset(editingStarterPreset) : false}
      />

      <StarterTemplateDisclaimerDialog
        open={disclaimerOpen}
        onOpenChange={(open) => {
          setDisclaimerOpen(open);
          if (!open) setPendingPreset(null);
        }}
        onConfirm={handleDisclaimerConfirm}
        loading={disclaimerSubmitting}
      />

      <TemplateAddedDialog
        open={addedTemplateDialog !== null}
        templateName={addedTemplateDialog?.name ?? null}
        onOpenChange={(open) => { if (!open) setAddedTemplateDialog(null); }}
        onOpenTemplate={handleOpenAddedTemplate}
      />

      {/* Preset browser sheet */}
      <PresetBrowser
        open={presetBrowserOpen}
        onOpenChange={setPresetBrowserOpen}
        addedPresetIds={addedPresetIdsMerged}
        addingPresetId={addingPresetId}
        onAddPreset={requestAddPreset}
        onOpenLibraryPreset={handleOpenLibraryPreset}
      />

      <PresetPreviewDialog
        preset={previewPreset}
        isAdded={previewPreset ? addedPresetIdsMerged.has(previewPreset.id) : false}
        isAdding={previewPreset ? addingPresetId === previewPreset.id : false}
        onClose={() => setPreviewPreset(null)}
        onAdd={requestAddPreset}
        onOpenLibrary={handleOpenLibraryPreset}
      />
    </StandardPage>
  );
}
