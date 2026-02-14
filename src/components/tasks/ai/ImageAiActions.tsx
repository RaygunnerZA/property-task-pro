/**
 * ImageAiActions — Phase 4 AI Actions panel for task images
 * User-confirmable operations: link assets, create assets, compliance, overlay
 */

import { useState } from "react";
import { Sparkles, Link2, Plus, Shield, Layers, Search, ChevronDown, RefreshCw } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CreateAssetFromAI } from "./CreateAssetFromAI";
import { CreateComplianceFromAI } from "./CreateComplianceFromAI";

export interface AttachmentWithAI {
  id: string;
  file_url?: string;
  thumbnail_url?: string;
  file_name?: string;
  ocr_text?: string | null;
  document_type?: string | null;
  expiry_date?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface AssetOption {
  id: string;
  name?: string | null;
  serial_number?: string | null;
  model?: string | null;
}

interface ImageAiActionsProps {
  attachment: AttachmentWithAI;
  assets: AssetOption[];
  complianceItems: Array<{ id: string; title?: string | null; expiry_date?: string | null }>;
  orgId: string;
  propertyId?: string | null;
  taskId?: string | null;
  onLinkAsset?: (assetId: string) => void;
  onRefresh?: () => void;
  onShowOverlays?: () => void;
}

export function ImageAiActions({
  attachment,
  assets,
  complianceItems,
  orgId,
  propertyId,
  onLinkAsset,
  onRefresh,
  onShowOverlays,
  taskId,
}: ImageAiActionsProps) {
  const { toast } = useToast();
  const [createAssetOpen, setCreateAssetOpen] = useState(false);
  const [createComplianceOpen, setCreateComplianceOpen] = useState(false);
  const [reRunning, setReRunning] = useState(false);

  const meta = (attachment.metadata || {}) as Record<string, unknown>;
  const detectedObjects = (meta.detected_objects as Array<{ type?: string; label?: string; confidence?: number; serial_number?: string; expiry_date?: string; model?: string }>) || [];
  const docClass = (meta.document_classification || {}) as { type?: string; expiry_date?: string };
  const normalizedDocType = (meta.normalized_document_type as string) || attachment.document_type || docClass.type;
  const normalizedExpiry = attachment.expiry_date || docClass.expiry_date;
  const status = attachment.status || (normalizedExpiry ? (() => {
    const exp = new Date(normalizedExpiry);
    const now = new Date();
    const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days < 0 ? "red" : days < 60 ? "amber" : "green";
  })() : null);

  const hasOcr = !!attachment.ocr_text?.trim();
  const hasDetected = detectedObjects.length > 0;
  const hasDoc = !!normalizedDocType || !!normalizedExpiry;
  const hasAny = hasOcr || hasDetected || hasDoc;

  if (!hasAny) return null;

  const handleLinkAsset = async (assetId: string) => {
    try {
      const { error } = await supabase.from("attachment_assets").insert({
        attachment_id: attachment.id,
        asset_id: assetId,
        org_id: orgId,
      });
      if (error) throw error;
      toast({ title: "Linked to asset" });
      onRefresh?.();
      onLinkAsset?.(assetId);
    } catch (e: any) {
      toast({ title: "Link failed", description: e.message, variant: "destructive" });
    }
  };

  const handleAssetCreated = () => {
    onRefresh?.();
  };

  const handleComplianceCreated = () => {
    onRefresh?.();
  };

  const handleLinkCompliance = async (complianceId: string) => {
    try {
      const { error } = await supabase.from("attachment_compliance").insert({
        attachment_id: attachment.id,
        compliance_document_id: complianceId,
        org_id: orgId,
      });
      if (error) throw error;
      toast({ title: "Linked to compliance record" });
      onRefresh?.();
    } catch (e: any) {
      toast({ title: "Link failed", description: e.message, variant: "destructive" });
    }
  };

  const firstObj = detectedObjects[0];
  const prefilledAsset = firstObj ? {
    name: firstObj.label || firstObj.type?.replace(/_/g, " ") || "",
    category: (meta.normalized_asset_type as string) || undefined,
    serial_number: firstObj.serial_number,
    model: firstObj.model,
    warranty_expiry: firstObj.expiry_date,
  } : undefined;

  const prefilledCompliance = {
    title: normalizedDocType || "Document",
    compliance_type: normalizedDocType || undefined,
    expiry_date: normalizedExpiry || undefined,
  };

  const handleReRunAnalysis = async () => {
    if (!attachment.file_url || !taskId || !orgId) return;
    setReRunning(true);
    try {
      const { error } = await supabase.functions.invoke("ai-image-analyse", {
        body: {
          file_url: attachment.file_url,
          attachment_id: attachment.id,
          org_id: orgId,
          task_id: taskId,
          overwrite: true,
        },
      });
      if (error) throw error;
      toast({ title: "AI analysis re-run", description: "Results will update shortly" });
      onRefresh?.();
    } catch (e: any) {
      toast({ title: "Re-run failed", description: e.message, variant: "destructive" });
    } finally {
      setReRunning(false);
    }
  };

  return (
    <Collapsible defaultOpen={false} className="group">
      <CollapsibleTrigger className="flex items-center gap-2 w-full text-left text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors py-2">
        <Search className="h-4 w-4 text-primary" />
        AI Actions
        <ChevronDown className="h-4 w-4 ml-auto transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="rounded-lg p-3 space-y-4 bg-muted/30 shadow-e1 text-[13px]">
          {/* A. Detected Items */}
          {hasDetected && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Detected Items</h4>
              <div className="space-y-1.5">
                {detectedObjects.slice(0, 5).map((obj, i) => (
                  <div key={i} className="flex items-center gap-2 text-foreground/90">
                    <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <span>{obj.label || obj.type}</span>
                    {obj.confidence !== undefined && (
                      <span className="text-muted-foreground text-[11px]">{(obj.confidence * 100).toFixed(0)}%</span>
                    )}
                    {(obj.serial_number || obj.model || obj.expiry_date) && (
                      <span className="text-muted-foreground text-[11px]">
                        {[obj.serial_number, obj.model, obj.expiry_date].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* B. Link to Asset */}
          {assets.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                Link to Asset
              </h4>
              <Select onValueChange={handleLinkAsset}>
                <SelectTrigger className="h-8 text-xs shadow-engraved">
                  <SelectValue placeholder="Select asset…" />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name || a.serial_number || "Unnamed"}
                      {a.serial_number || a.model ? ` (${[a.serial_number, a.model].filter(Boolean).join(", ")})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* C. Create New Asset */}
          {(hasDetected || !assets.length) && propertyId && (
            <div>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs shadow-e1"
                onClick={() => setCreateAssetOpen(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Create New Asset from Image
              </Button>
              <CreateAssetFromAI
                open={createAssetOpen}
                onOpenChange={setCreateAssetOpen}
                orgId={orgId}
                propertyId={propertyId}
                attachmentId={attachment.id}
                prefilled={prefilledAsset}
                onAssetCreated={handleAssetCreated}
              />
            </div>
          )}

          {/* D. Compliance Signals */}
          {hasDoc && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Compliance Signals
              </h4>
              <div className="space-y-1.5 mb-2">
                {normalizedDocType && <p className="text-foreground/80">Document: {normalizedDocType}</p>}
                {normalizedExpiry && (
                  <p className="text-foreground/80">
                    Expiry: {normalizedExpiry}
                    {status && (
                      <span
                        className={cn(
                          "ml-2 rounded px-1.5 text-[10px] font-medium",
                          status === "green" && "bg-green-500/20 text-green-700",
                          status === "amber" && "bg-amber-500/20 text-amber-700",
                          status === "red" && "bg-red-500/20 text-red-700"
                        )}
                      >
                        {status}
                      </span>
                    )}
                  </p>
                )}
              </div>
              {complianceItems.length > 0 && (
                <Select onValueChange={handleLinkCompliance}>
                  <SelectTrigger className="h-8 text-xs shadow-engraved mb-2">
                    <SelectValue placeholder="Link to existing…" />
                  </SelectTrigger>
                  <SelectContent>
                    {complianceItems.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title || "Untitled"}
                        {c.expiry_date ? ` · ${c.expiry_date}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs shadow-e1"
                onClick={() => setCreateComplianceOpen(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Create New Compliance Record
              </Button>
              <CreateComplianceFromAI
                open={createComplianceOpen}
                onOpenChange={setCreateComplianceOpen}
                orgId={orgId}
                attachmentId={attachment.id}
                prefilled={prefilledCompliance}
                onComplianceCreated={handleComplianceCreated}
              />
            </div>
          )}

          {/* E. Show AI Regions in Editor */}
          {hasDetected && onShowOverlays && (
            <div>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8 text-xs shadow-e1"
                onClick={onShowOverlays}
              >
                <Layers className="h-3.5 w-3.5 mr-1.5" />
                Show AI Regions in Editor
              </Button>
            </div>
          )}

          {/* Re-run AI analysis */}
          {attachment.file_url && taskId && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs text-muted-foreground"
                onClick={handleReRunAnalysis}
                disabled={reRunning}
              >
                <RefreshCw className={cn("h-3 w-3 mr-1.5", reRunning && "animate-spin")} />
                {reRunning ? "Re-running…" : "Re-run AI analysis"}
              </Button>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
