import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { FileText, AlertCircle, CheckCircle2, AlertTriangle, ExternalLink, RefreshCw, Link2, Sparkles, ChevronDown, Shield } from "lucide-react";
import { Chip } from "@/components/chips/Chip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import type { PropertyDocument, DocMetadata } from "@/hooks/property/usePropertyDocuments";

interface DocumentCardProps {
  document: PropertyDocument;
  propertyId?: string;
  suggestedSpaces?: { id: string; name: string }[];
  suggestedAssets?: { id: string; name: string }[];
  suggestedCompliance?: { id: string; title: string }[];
  onClick?: () => void;
  onOpen?: () => void;
  onReplace?: () => void;
  onLinkItems?: () => void;
  onLinkSpace?: (spaceId: string) => void;
  onLinkAsset?: (assetId: string) => void;
  onLinkCompliance?: (complianceId: string) => void;
}

function getStatusConfig(status: string | null) {
  const s = (status || "unknown").toLowerCase();
  if (s === "missing" || s === "absent") {
    return { color: "hsl(var(--muted-foreground))", bgColor: "bg-muted/30", icon: AlertCircle, label: "Missing" };
  }
  if (s === "valid" || s === "active" || s === "green") {
    return { color: "hsl(var(--success))", bgColor: "bg-success/10", icon: CheckCircle2, label: "Valid" };
  }
  if (s === "expiring" || s === "amber" || s === "warning") {
    return { color: "hsl(var(--warning))", bgColor: "bg-warning/10", icon: AlertTriangle, label: "Expiring" };
  }
  if (s === "expired" || s === "red") {
    return { color: "hsl(var(--destructive))", bgColor: "bg-destructive/10", icon: AlertCircle, label: "Expired" };
  }
  return { color: "hsl(var(--muted-foreground))", bgColor: "bg-muted/30", icon: FileText, label: "Unknown" };
}

function getFileIcon(fileType: string | null) {
  if (!fileType) return FileText;
  if (fileType.includes("pdf")) return FileText;
  return FileText;
}

export function DocumentCard({
  document,
  propertyId,
  suggestedSpaces = [],
  suggestedAssets = [],
  suggestedCompliance = [],
  onClick,
  onOpen,
  onReplace,
  onLinkItems,
  onLinkSpace,
  onLinkAsset,
  onLinkCompliance,
}: DocumentCardProps) {
  const rawName = document.title || document.file_name || document.document_type || "Unknown Document";
  const name = rawName.replace(/\.[^/.]+$/, "");
  const statusConfig = getStatusConfig(document.status);
  const StatusIcon = statusConfig.icon;
  const FileIcon = getFileIcon(document.file_type);

  const meta = (document.metadata || {}) as DocMetadata;
  const detectedSpaces = meta.detected_spaces || [];
  const detectedAssets = meta.detected_assets || [];
  const hazards = meta.hazards || [];
  const complianceRecs = meta.compliance_recommendations || [];
  const hasAiInsights =
    document.document_type ||
    document.category ||
    document.expiry_date ||
    document.renewal_frequency ||
    detectedSpaces.length > 0 ||
    detectedAssets.length > 0 ||
    hazards.length > 0 ||
    complianceRecs.length > 0;

  const linkedCount =
    (document.linked_spaces?.length || 0) +
    (document.linked_assets?.length || 0) +
    (document.linked_contractors?.length || 0) +
    (document.linked_compliance?.length || 0);

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-[8px] bg-card shadow-e1",
        "cursor-pointer hover:shadow-e2 active:shadow-e1 transition-all duration-150",
        "overflow-hidden flex flex-col min-h-[120px] relative group",
        "border border-border/50"
      )}
    >
      {/* Thumbnail or icon area */}
      <div className="flex items-start gap-3 p-3">
        {document.thumbnail_url ? (
          <img
            src={document.thumbnail_url}
            alt=""
            className="w-12 h-12 rounded-[5px] object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-[5px] bg-muted/50 flex items-center justify-center flex-shrink-0">
            <FileIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-sm line-clamp-2">{name}</h3>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {document.category && (
              <Chip role="filter" label={document.category} className="h-[20px] text-[10px] px-1.5" />
            )}
            <Chip
              role="status"
              label={statusConfig.label}
              color={statusConfig.color}
              className="h-[20px] text-[10px] px-1.5"
            />
          </div>
        </div>
      </div>

      {/* Linked items */}
      {linkedCount > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1">
          {document.linked_spaces?.slice(0, 2).map((s) => (
            <span key={s.id} className="text-[10px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">
              {s.name}
            </span>
          ))}
          {document.linked_assets?.slice(0, 2).map((a) => (
            <span key={a.id} className="text-[10px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">
              {a.name}
            </span>
          ))}
          {linkedCount > 4 && (
            <span className="text-[10px] text-muted-foreground">+{linkedCount - 4}</span>
          )}
        </div>
      )}

      {/* AI Insights - Collapsible */}
      {hasAiInsights && (
        <Collapsible defaultOpen={false} className="group/ai">
          <CollapsibleTrigger
            className="flex items-center gap-1.5 w-full px-3 py-1.5 text-left text-[11px] font-medium text-primary/90 hover:text-primary border-t border-border/30"
            onClick={(e) => e.stopPropagation()}
          >
            <Sparkles className="h-3 w-3" />
            AI Insight
            <ChevronDown className="h-3 w-3 ml-auto transition-transform group-data-[state=open]/ai:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-3 pb-2 pt-1 space-y-2 text-[11px] border-t border-border/20" onClick={(e) => e.stopPropagation()}>
              {document.document_type && (
                <p><span className="text-muted-foreground">Type:</span> {document.document_type}</p>
              )}
              {document.category && (
                <p><span className="text-muted-foreground">Category:</span> {document.category}</p>
              )}
              {(document.expiry_date || document.renewal_frequency) && (
                <p>
                  <span className="text-muted-foreground">Expiry:</span> {document.expiry_date || "—"}
                  {document.renewal_frequency && ` · ${document.renewal_frequency}`}
                </p>
              )}
              {document.status && (
                <Chip
                  role="status"
                  label={getStatusConfig(document.status).label}
                  color={getStatusConfig(document.status).color}
                  className="h-[18px] text-[10px] px-1.5"
                />
              )}
              {hazards.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Hazards:</span>{" "}
                  <span className="text-amber-600 font-medium">{hazards.join(", ")}</span>
                </div>
              )}
              {detectedSpaces.length > 0 && (
                <p className="text-muted-foreground">
                  Belongs to: {detectedSpaces.slice(0, 3).join(", ")}
                </p>
              )}
              {detectedAssets.length > 0 && (
                <p className="text-muted-foreground">
                  Relates to: {detectedAssets.slice(0, 2).map((a) => a.name || a.serial_number || a.model).filter(Boolean).join(", ") || "—"}
                </p>
              )}

              {/* Link Suggestions */}
              {(suggestedSpaces.length > 0 || suggestedAssets.length > 0 || suggestedCompliance.length > 0) && (
                <div className="pt-2 space-y-2">
                  {suggestedSpaces.length > 0 && onLinkSpace && (
                    <div>
                      <span className="text-muted-foreground text-[10px] uppercase">Spaces</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {suggestedSpaces.slice(0, 4).map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onLinkSpace(s.id);
                            }}
                            className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] hover:bg-primary/20"
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {suggestedAssets.length > 0 && onLinkAsset && (
                    <div>
                      <span className="text-muted-foreground text-[10px] uppercase">Assets</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {suggestedAssets.slice(0, 4).map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onLinkAsset(a.id);
                            }}
                            className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] hover:bg-primary/20"
                          >
                            {a.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {suggestedCompliance.length > 0 && onLinkCompliance && (
                    <div>
                      <span className="text-muted-foreground text-[10px] uppercase flex items-center gap-1">
                        <Shield className="h-2.5 w-2.5" /> Compliance
                      </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {suggestedCompliance.slice(0, 4).map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onLinkCompliance(c.id);
                            }}
                            className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] hover:bg-primary/20"
                          >
                            {c.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {onLinkItems && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] mt-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLinkItems();
                  }}
                >
                  Review AI suggestions
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Timestamp */}
      <div className="px-3 pb-3 text-[10px] text-muted-foreground">
        Updated {formatDistanceToNow(new Date(document.updated_at), { addSuffix: true })}
      </div>

      {/* Hover actions (desktop) */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end gap-2 p-3 bg-gradient-to-t from-background/80 to-transparent pointer-events-none group-hover:pointer-events-auto">
        {onOpen && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-[5px] bg-card shadow-e1 text-xs hover:shadow-e2"
          >
            <ExternalLink className="h-3 w-3" />
            Open
          </button>
        )}
        {onReplace && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReplace();
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-[5px] bg-card shadow-e1 text-xs hover:shadow-e2"
          >
            <RefreshCw className="h-3 w-3" />
            Replace
          </button>
        )}
        {onLinkItems && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLinkItems();
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-[5px] bg-card shadow-e1 text-xs hover:shadow-e2"
          >
            <Link2 className="h-3 w-3" />
            Link items
          </button>
        )}
      </div>
    </div>
  );
}
