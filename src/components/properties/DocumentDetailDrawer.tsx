import { useState, useEffect, useCallback, useRef } from "react";
import { useDocumentDetail, type DocumentWithLinks } from "@/hooks/property/useDocumentDetail";
import { useSpaces } from "@/hooks/useSpaces";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SemanticChip } from "@/components/chips/semantic";
import { debounce } from "@/lib/debounce";
import {
  X,
  Download,
  Trash2,
  RefreshCw,
  FileText,
  Sparkles,
  ExternalLink,
  CheckSquare,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAssistantContext } from "@/contexts/AssistantContext";
import { FillaIcon } from "@/components/filla/FillaIcon";
import { DOCUMENT_CATEGORIES } from "@/hooks/property/usePropertyDocuments";

interface DocumentDetailDrawerProps {
  documentId: string | null;
  propertyId: string;
  onClose: () => void;
  onRefresh?: () => void;
}

const RENEWAL_OPTIONS = ["6mo", "1yr", "2yr", "5yr", "custom"];

export function DocumentDetailDrawer({
  documentId,
  propertyId,
  onClose,
  onRefresh,
}: DocumentDetailDrawerProps) {
  const { document, isLoading, update, updateLinks, refresh } = useDocumentDetail(documentId);
  const { spaces } = useSpaces(propertyId);
  const { data: assets = [] } = useAssetsQuery(propertyId);
  const { orgId } = useActiveOrg();
  const { toast } = useToast();
  const { openAssistant } = useAssistantContext();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [renewalFrequency, setRenewalFrequency] = useState("");
  const [notes, setNotes] = useState("");
  const initialLoadDone = useRef(false);

  useEffect(() => {
    if (document) {
      setTitle(document.title || "");
      setCategory(document.category || "");
      setDocumentType(document.document_type || "");
      setExpiryDate(document.expiry_date || "");
      setRenewalFrequency(document.renewal_frequency || "");
      setNotes(document.notes || "");
      initialLoadDone.current = true;
    } else {
      initialLoadDone.current = false;
    }
  }, [document]);

  const debouncedUpdate = useCallback(
    debounce((updates: Parameters<typeof update>[0]) => {
      update(updates);
      toast({ title: "Saved", description: "Document updated" });
    }, 300),
    [update, toast]
  );

  useEffect(() => {
    if (!documentId || !document || !initialLoadDone.current) return;
    const changed =
      title !== (document.title || "") ||
      category !== (document.category || "") ||
      documentType !== (document.document_type || "") ||
      expiryDate !== (document.expiry_date || "") ||
      renewalFrequency !== (document.renewal_frequency || "") ||
      notes !== (document.notes || "");
    if (!changed) return;
    debouncedUpdate({
      title: title || null,
      category: category || null,
      document_type: documentType || null,
      expiry_date: expiryDate || null,
      renewal_frequency: renewalFrequency || null,
      notes: notes || null,
    });
  }, [title, category, documentType, expiryDate, renewalFrequency, notes, document]);

  const handleDownload = () => {
    if (document?.file_url) {
      window.open(document.file_url, "_blank");
    }
  };

  const handleReplace = () => {
    toast({ title: "Replace", description: "Replace document flow - use upload zone" });
  };

  const handleDelete = async () => {
    if (!documentId || !orgId) return;
    const { error } = await import("@/integrations/supabase/client").then(({ supabase }) =>
      supabase.from("attachments").delete().eq("id", documentId).eq("org_id", orgId)
    );
    if (error) {
      toast({ title: "Delete failed", variant: "destructive" });
      return;
    }
    toast({ title: "Deleted" });
    onClose();
    onRefresh?.();
  };

  const handleCreateTask = () => {
    toast({ title: "Create Task", description: "Create task from document - coming soon" });
  };

  const handleAnnotate = () => {
    toast({ title: "Annotate", description: "PDF/image annotation - coming soon" });
  };

  const aiSuggestions = [
    { type: "space" as const, id: "s1", label: "Plant Room (Space)" },
    { type: "asset" as const, id: "a1", label: "Fire Alarm Panel (Asset)" },
    { type: "compliance" as const, id: "c1", label: "Annual Fire Inspection (Compliance)" },
  ];

  const handleAddAllSuggestions = () => {
    toast({ title: "Added", description: "AI suggestions applied" });
  };

  if (!documentId) return null;

  return (
    <Sheet open={!!documentId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className={cn("w-[420px] max-w-[480px] overflow-y-auto p-0 flex flex-col")}
      >
        <SheetHeader className="p-4 border-b border-border/20 shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg">Document Details</SheetTitle>
            {documentId && (
              <button
                onClick={() => openAssistant({ type: "document", id: documentId, name: document?.title })}
                className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
                aria-label="Open Assistant"
              >
                <FillaIcon size={20} />
              </button>
            )}
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="flex-1 p-4 text-muted-foreground">Loading...</div>
        ) : !document ? (
          <div className="flex-1 p-4 text-muted-foreground">Document not found</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Preview */}
            <section>
              <h3 className="text-sm font-semibold mb-2">Preview</h3>
              <div className="rounded-[8px] bg-muted/30 overflow-hidden min-h-[200px] border border-border/30">
                {document.file_url && (
                  <>
                    {document.file_type?.includes("pdf") ? (
                      <iframe
                        src={document.file_url}
                        title="Document preview"
                        className="w-full h-[280px] border-0"
                      />
                    ) : document.file_type?.startsWith("image/") ? (
                      <img
                        src={document.file_url}
                        alt=""
                        className="w-full max-h-[280px] object-contain"
                      />
                    ) : (
                      <a
                        href={document.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 p-4 text-primary"
                      >
                        <FileText className="h-8 w-8" />
                        Open file
                      </a>
                    )}
                  </>
                )}
              </div>
            </section>

            {/* Metadata */}
            <section>
              <h3 className="text-sm font-semibold mb-3">Details</h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Title</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="rounded-[8px] mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Category</Label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-[8px] border border-input bg-background px-3 py-2 text-sm mt-1"
                  >
                    <option value="">Select...</option>
                    {DOCUMENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Document type</Label>
                  <Input
                    value={documentType}
                    onChange={(e) => setDocumentType(e.target.value)}
                    className="rounded-[8px] mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Expiry date</Label>
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="rounded-[8px] mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Renewal frequency</Label>
                  <select
                    value={renewalFrequency}
                    onChange={(e) => setRenewalFrequency(e.target.value)}
                    className="w-full rounded-[8px] border border-input bg-background px-3 py-2 text-sm mt-1"
                  >
                    <option value="">Select...</option>
                    {RENEWAL_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="rounded-[8px] mt-1 min-h-[60px]"
                  />
                </div>
              </div>
            </section>

            {/* Linked items */}
            <section>
              <h3 className="text-sm font-semibold mb-2">Linked items</h3>
              <div className="flex flex-wrap gap-2">
                {document.linked_spaces?.map((s) => (
                  <SemanticChip
                    key={s.id}
                    epistemic="fact"
                    label={s.name}
                    removable
                    onRemove={() =>
                      updateLinks({
                        spaces: document.linked_spaces!.filter((x) => x.id !== s.id).map((x) => x.id),
                      })
                    }
                  />
                ))}
                {document.linked_assets?.map((a) => (
                  <SemanticChip
                    key={a.id}
                    epistemic="fact"
                    label={a.name}
                    removable
                    onRemove={() =>
                      updateLinks({
                        assets: document.linked_assets!.filter((x) => x.id !== a.id).map((x) => x.id),
                      })
                    }
                  />
                ))}
                {document.linked_contractors?.map((c) => (
                  <SemanticChip
                    key={c.id}
                    epistemic="fact"
                    label={c.name}
                    removable
                    onRemove={() =>
                      updateLinks({
                        contractors: document.linked_contractors!.filter((x) => x.id !== c.id).map((x) => x.id),
                      })
                    }
                  />
                ))}
                {document.linked_compliance?.map((c) => (
                  <SemanticChip
                    key={c.id}
                    epistemic="fact"
                    label={c.title}
                    removable
                    onRemove={() =>
                      updateLinks({
                        compliance: document.linked_compliance!.filter((x) => x.id !== c.id).map((x) => x.id),
                      })
                    }
                  />
                ))}
              </div>

              {/* AI suggestions */}
              <div className="mt-3 p-3 rounded-[8px] bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 text-sm font-medium text-primary mb-2">
                  <Sparkles className="h-4 w-4" />
                  AI suggests linking
                </div>
                <ul className="text-sm text-muted-foreground space-y-1 mb-3">
                  {aiSuggestions.map((s) => (
                    <li key={s.id}>• {s.label}</li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleAddAllSuggestions}>
                    Add All
                  </Button>
                  <Button size="sm" variant="ghost">
                    Review
                  </Button>
                </div>
              </div>
            </section>

            {/* Actions */}
            <section>
              <h3 className="text-sm font-semibold mb-2">Actions</h3>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button size="sm" variant="outline" onClick={handleReplace}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Replace
                </Button>
                <Button size="sm" variant="outline" onClick={handleCreateTask}>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Create Task
                </Button>
                <Button size="sm" variant="outline" onClick={handleAnnotate}>
                  <FileText className="h-4 w-4 mr-2" />
                  Annotate
                </Button>
                <Button size="sm" variant="destructive" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
