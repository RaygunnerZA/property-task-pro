import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  usePropertyDocuments,
  type PropertyDocument,
} from "@/hooks/property/usePropertyDocuments";
import { useSpaces } from "@/hooks/useSpaces";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { DocumentDetailDrawer } from "@/components/properties/DocumentDetailDrawer";
import { useDocumentUpload } from "@/hooks/property/useDocumentUpload";
import { useAttachmentSpaceLinks } from "@/hooks/property/useAttachmentSpaceLinks";
import { ComplianceDetailDrawer } from "@/components/compliance/ComplianceDetailDrawer";
import type { RecordsView } from "@/lib/propertyRoutes";
import type { IntakeMode } from "@/types/intake";
import {
  buildComplianceRecordsFromPortfolio,
  type ComplianceRecord,
} from "./complianceRecordModel";
import { RecordsExplorer } from "./RecordsExplorer";
import type { RecordsOrganiseView } from "./RecordsExplorer";
import { RecordsObligationAttentionRow } from "./RecordsObligationAttentionRow";
import {
  partitionPropertySpaces,
  toOnboardingAreas,
} from "@/lib/spaces/partitionPropertySpaces";
import {
  documentDisplayTitle,
  filedToastMessage,
  removedLinkToastMessage,
  spaceIdsToAdd,
} from "@/lib/records/attachmentSpaces";
import { useCompliancePortfolioQuery } from "@/hooks/useCompliancePortfolioQuery";

const RECORDS_FILE_ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv";

let recordsUploadDeepLinkNonce = 0;

export type PropertyRecordsTabProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties: any[];
  selectedPropertyIds?: Set<string>;
  recordsView: RecordsView;
  onRecordsViewChange: (next: RecordsView) => void;
  onOpenIntake?: (mode: IntakeMode) => void;
  extraComplianceRecords?: ComplianceRecord[];
  recordsSearch?: string;
  onRecordsSearchChange?: (value: string) => void;
};

/**
 * Records centre workspace — document explorer (category × location × attention).
 * Compliance obligations needing action surface in Attention (non-draggable).
 */
export function PropertyRecordsTab({
  properties,
  selectedPropertyIds,
  recordsView,
  onRecordsViewChange: _onRecordsViewChange,
  onOpenIntake: _onOpenIntake,
  extraComplianceRecords = [],
  recordsSearch: recordsSearchProp,
  onRecordsSearchChange,
}: PropertyRecordsTabProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { orgId } = useActiveOrg();
  const { toast } = useToast();

  const [internalRecordsSearch, setInternalRecordsSearch] = useState("");
  const recordsSearch = recordsSearchProp ?? internalRecordsSearch;
  const setRecordsSearch = onRecordsSearchChange ?? setInternalRecordsSearch;

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [selectedComplianceId, setSelectedComplianceId] = useState<string | null>(null);
  const [explorerView, setExplorerView] = useState<RecordsOrganiseView>("attention");
  const [complianceCreateNonce, setComplianceCreateNonce] = useState(0);

  // Deep link: `?documentId=` opens the document detail (detail chrome rule,
  // @Docs/04_UI_System.md — selection is deep-linkable on all three surfaces).
  const documentIdFromUrl = searchParams.get("documentId")?.trim() || null;

  useEffect(() => {
    if (documentIdFromUrl) setSelectedDocId(documentIdFromUrl);
  }, [documentIdFromUrl]);

  const openDocument = useCallback(
    (docId: string | null) => {
      setSelectedDocId(docId);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (docId) next.set("documentId", docId);
          else next.delete("documentId");
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const recordsUploadInputRef = useRef<HTMLInputElement | null>(null);
  const lastRailPickerOpenMs = useRef(0);

  const scopedPropertyId =
    selectedPropertyIds && selectedPropertyIds.size === 1
      ? Array.from(selectedPropertyIds)[0]
      : null;

  const filingEnabled = Boolean(scopedPropertyId);

  const { upload: uploadPropertyDocuments, uploading: recordsUploading } = useDocumentUpload(
    scopedPropertyId ?? ""
  );
  const { addSpaceLink, removeSpaceLink, setSpaceLinks } = useAttachmentSpaceLinks();

  const { data: compliancePortfolio = [] } = useCompliancePortfolioQuery();
  const { documents, isLoading: docsLoading } = usePropertyDocuments(
    scopedPropertyId || undefined,
    { search: recordsSearch || undefined },
    { limit: 500, enabled: !!scopedPropertyId }
  );
  const { spaces } = useSpaces(scopedPropertyId || "");

  const {
    areas: partitionedAreas,
    roomsByAreaId,
    unassigned: unassignedRooms,
  } = useMemo(() => partitionPropertySpaces(spaces ?? []), [spaces]);

  const onboardingAreas = useMemo(
    () => toOnboardingAreas(partitionedAreas),
    [partitionedAreas]
  );

  const complianceRecords = useMemo(
    () => buildComplianceRecordsFromPortfolio(compliancePortfolio, extraComplianceRecords),
    [compliancePortfolio, extraComplianceRecords]
  );

  const scopedComplianceRecords = useMemo(() => {
    if (
      !selectedPropertyIds ||
      selectedPropertyIds.size === 0 ||
      selectedPropertyIds.size >= properties.length
    ) {
      return complianceRecords;
    }
    return complianceRecords.filter(
      (r) => r.propertyId && selectedPropertyIds.has(r.propertyId)
    );
  }, [complianceRecords, selectedPropertyIds, properties.length]);

  const attentionObligations = useMemo(
    () =>
      scopedComplianceRecords.filter(
        (r) => r.status === "overdue" || r.status === "expiring" || r.status === "missing"
      ),
    [scopedComplianceRecords]
  );

  useEffect(() => {
    if (recordsView === "expiring" || recordsView === "overdue" || recordsView === "missing") {
      setExplorerView("attention");
    } else if (recordsView === "compliance") {
      setExplorerView("compliance");
    }
  }, [recordsView]);

  useEffect(() => {
    if (searchParams.get("upload") !== "1") return;
    const myNonce = ++recordsUploadDeepLinkNonce;
    const next = new URLSearchParams(searchParams);
    next.delete("upload");
    setSearchParams(next, { replace: true });
    if (!scopedPropertyId) {
      toast({
        title: "Select a property",
        description: "Pick one property, then upload documents from Records.",
        variant: "destructive",
      });
      return;
    }
    const t = window.setTimeout(() => {
      if (myNonce !== recordsUploadDeepLinkNonce) return;
      recordsUploadInputRef.current?.click();
    }, 0);
    return () => window.clearTimeout(t);
  }, [searchParams, setSearchParams, scopedPropertyId, toast]);

  useEffect(() => {
    if (searchParams.get("addRule") !== "1" || !scopedPropertyId) return;
    const next = new URLSearchParams(searchParams);
    next.delete("addRule");
    setSearchParams(next, { replace: true });
    setExplorerView("compliance");
    setComplianceCreateNonce((n) => n + 1);
  }, [searchParams, scopedPropertyId, setSearchParams]);

  const openRecordsFilePicker = useCallback(() => {
    if (!scopedPropertyId) {
      toast({
        title: "Select a property",
        description: "Select exactly one property to upload documents.",
        variant: "destructive",
      });
      return;
    }
    const now = Date.now();
    if (now - lastRailPickerOpenMs.current < 1200) return;
    lastRailPickerOpenMs.current = now;
    window.requestAnimationFrame(() => {
      recordsUploadInputRef.current?.click();
    });
  }, [scopedPropertyId, toast]);

  useEffect(() => {
    const onOpenUpload = () => openRecordsFilePicker();
    window.addEventListener("filla:records-open-upload", onOpenUpload);
    return () => window.removeEventListener("filla:records-open-upload", onOpenUpload);
  }, [openRecordsFilePicker]);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["property-documents"] });
    queryClient.invalidateQueries({ queryKey: ["document-detail"] });
    queryClient.invalidateQueries({ queryKey: ["compliance_portfolio"] });
  }, [queryClient]);

  const handleFileToSpace = useCallback(
    async (doc: PropertyDocument, spaceId: string) => {
      const currentIds = (doc.linked_spaces ?? []).map((s) => s.id);
      const spaceName =
        (spaces ?? []).find((s) => s.id === spaceId)?.name?.trim() || "space";
      try {
        const result = await addSpaceLink(doc.id, spaceId, currentIds);
        toast({
          title:
            result === "already"
              ? `Already filed to ${spaceName}`
              : filedToastMessage(spaceName),
        });
      } catch (e: unknown) {
        toast({
          title: "Could not file document",
          description: e instanceof Error ? e.message : String(e),
          variant: "destructive",
        });
      }
    },
    [addSpaceLink, spaces, toast]
  );

  const handleRemoveSpaceLink = useCallback(
    async (doc: PropertyDocument, spaceId: string, spaceName: string) => {
      try {
        await removeSpaceLink(doc.id, spaceId);
        toast({ title: removedLinkToastMessage(spaceName) });
      } catch (e: unknown) {
        toast({
          title: "Could not remove link",
          description: e instanceof Error ? e.message : String(e),
          variant: "destructive",
        });
      }
    },
    [removeSpaceLink, toast]
  );

  const handleSetSpaceLinks = useCallback(
    async (doc: PropertyDocument, spaceIds: string[]) => {
      const currentIds = (doc.linked_spaces ?? []).map((s) => s.id);
      const { added, removed } = await setSpaceLinks(doc.id, spaceIds, currentIds);
      if (added === 0 && removed === 0) {
        toast({ title: "No changes" });
        return;
      }
      if (spaceIds.length === 0) {
        toast({ title: "Kept at property level" });
        return;
      }
      toast({
        title:
          added === 1 && removed === 0
            ? filedToastMessage(
                (spaces ?? []).find((s) => s.id === spaceIds.find((id) => !currentIds.includes(id)))
                  ?.name ?? "space"
              )
            : "Space links updated",
      });
    },
    [setSpaceLinks, spaces, toast]
  );

  const handleAddSpaceLinksBulk = useCallback(
    async (docs: PropertyDocument[], spaceIds: string[]) => {
      let added = 0;
      for (const doc of docs) {
        const current = (doc.linked_spaces ?? []).map((s) => s.id);
        for (const spaceId of spaceIds) {
          if (spaceIdsToAdd(current, spaceId).length === 0) continue;
          const result = await addSpaceLink(doc.id, spaceId, current);
          if (result === "added") {
            added += 1;
            current.push(spaceId);
          }
        }
      }
      toast({
        title:
          added === 0
            ? "Already filed"
            : added === 1
              ? "Filed to location"
              : `Added ${added} location links`,
      });
    },
    [addSpaceLink, toast]
  );

  const handleChangeCategory = useCallback(
    async (docs: PropertyDocument[], category: string | null) => {
      if (!orgId) return;
      for (const doc of docs) {
        const { data: row, error: fetchErr } = await supabase
          .from("attachments")
          .select("metadata")
          .eq("id", doc.id)
          .eq("org_id", orgId)
          .single();
        if (fetchErr) throw fetchErr;
        const prev =
          row?.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
            ? (row.metadata as Record<string, unknown>)
            : {};
        const { error } = await supabase
          .from("attachments")
          .update({
            metadata: { ...prev, category } as import("@/integrations/supabase/types").Json,
            updated_at: new Date().toISOString(),
          })
          .eq("id", doc.id)
          .eq("org_id", orgId);
        if (error) throw error;
      }
      toast({
        title: category ? `Category set to ${category}` : "Marked uncategorised",
      });
      handleRefresh();
    },
    [orgId, toast, handleRefresh]
  );

  const handleDeleteDocument = useCallback(
    async (doc: PropertyDocument) => {
      if (!orgId) return;
      const title = documentDisplayTitle(doc);
      if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
      const { error } = await supabase
        .from("attachments")
        .delete()
        .eq("id", doc.id)
        .eq("org_id", orgId);
      if (error) {
        toast({ title: "Delete failed", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Deleted" });
      handleRefresh();
    },
    [orgId, toast, handleRefresh]
  );

  const runRecordsFileUpload = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length || !scopedPropertyId) return;
      try {
        const created = await uploadPropertyDocuments(Array.from(fileList));
        toast({
          title: "Upload complete",
          description: `${created.length} document(s) uploaded · set a type so they don't sit in “Needs info”`,
          action:
            created.length > 0 ? (
              <ToastAction
                altText="Open explorer"
                onClick={() => {
                  handleRefresh();
                }}
              >
                Done
              </ToastAction>
            ) : undefined,
        });
        handleRefresh();
      } catch (e: unknown) {
        toast({
          title: "Upload failed",
          description: e instanceof Error ? e.message : String(e),
          variant: "destructive",
        });
      }
    },
    [scopedPropertyId, uploadPropertyDocuments, toast, handleRefresh]
  );

  const selectedComplianceRecord = useMemo(
    () =>
      selectedComplianceId
        ? attentionObligations.find((r) => r.id === selectedComplianceId) ??
          scopedComplianceRecords.find((r) => r.id === selectedComplianceId) ??
          null
        : null,
    [selectedComplianceId, attentionObligations, scopedComplianceRecords]
  );

  const [complianceDrawerOpen, setComplianceDrawerOpen] = useState(false);
  useEffect(() => {
    setComplianceDrawerOpen(Boolean(selectedComplianceRecord));
  }, [selectedComplianceRecord]);

  return (
    <div className="flex h-full min-h-0 flex-col pt-0 max-sm:px-0">
      {recordsUploading ? (
        <p className="mb-2 text-xs text-muted-foreground" aria-live="polite">
          Uploading…
        </p>
      ) : null}

      {!scopedPropertyId ? (
        <p className="mb-3 text-xs text-muted-foreground">
          Select one property to organise records by space.
        </p>
      ) : null}

      <div className="min-h-0 flex-1">
        {scopedPropertyId ? (
          <RecordsExplorer
            documents={documents}
            spaces={spaces ?? []}
            areas={onboardingAreas}
            roomsByAreaId={roomsByAreaId}
            unassignedRooms={unassignedRooms}
            filingEnabled={filingEnabled}
            docsLoading={docsLoading}
            searchQuery={recordsSearch}
            onSearchQueryChange={setRecordsSearch}
            view={explorerView}
            onViewChange={setExplorerView}
            attentionObligations={attentionObligations}
            onOpenObligation={setSelectedComplianceId}
            propertyId={scopedPropertyId}
            complianceCreateNonce={complianceCreateNonce}
            onOpenDocument={openDocument}
            onAddRecord={openRecordsFilePicker}
            onFileToSpace={handleFileToSpace}
            onRemoveSpaceLink={handleRemoveSpaceLink}
            onSetSpaceLinks={handleSetSpaceLinks}
            onAddSpaceLinksBulk={handleAddSpaceLinksBulk}
            onChangeCategory={handleChangeCategory}
            onDeleteDocument={handleDeleteDocument}
          />
        ) : (
          <div className="rounded-[12px] bg-card/60 p-6 text-center shadow-e1">
            <p className="text-sm text-muted-foreground">
              Select a single property to browse and file documents.
            </p>
            {attentionObligations.length > 0 ? (
              <div className="mx-auto mt-4 max-w-lg space-y-2 text-left">
                <p className="text-xs text-muted-foreground">
                  Portfolio obligations needing attention:
                </p>
                {attentionObligations.map((record) => (
                  <RecordsObligationAttentionRow
                    key={record.id}
                    record={record}
                    onOpen={() => setSelectedComplianceId(record.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Portfolio compliance obligations appear here when they need action.
              </p>
            )}
          </div>
        )}
      </div>

      <ComplianceDetailDrawer
        open={complianceDrawerOpen}
        onOpenChange={(open) => {
          setComplianceDrawerOpen(open);
          if (!open) setSelectedComplianceId(null);
        }}
        compliance={
          selectedComplianceRecord
            ? {
                id: selectedComplianceRecord.id,
                title: selectedComplianceRecord.title,
                property_id: selectedComplianceRecord.propertyId,
                property_name: selectedComplianceRecord.propertyName,
                expiry_date: selectedComplianceRecord.expiryDate,
                next_due_date: selectedComplianceRecord.nextDueDate,
                expiry_state:
                  selectedComplianceRecord.status === "overdue"
                    ? "expired"
                    : selectedComplianceRecord.status === "expiring"
                      ? "expiring"
                      : "valid",
                document_type: selectedComplianceRecord.complianceType,
              }
            : null
        }
      />

      <DocumentDetailDrawer
        documentId={selectedDocId}
        propertyId={scopedPropertyId ?? ""}
        onClose={() => openDocument(null)}
        onRefresh={handleRefresh}
      />

      <input
        ref={recordsUploadInputRef}
        type="file"
        multiple
        className="sr-only"
        accept={RECORDS_FILE_ACCEPT}
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const files = e.target.files;
          void runRecordsFileUpload(files);
          window.requestAnimationFrame(() => {
            e.target.value = "";
          });
        }}
      />
    </div>
  );
}
