/**
 * Document Health Summary — row layout aligned with PropertyIdentityStrip PROPERTY tab.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileText, AlertCircle, AlertTriangle, Link2, Shield, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import type { PropertyDocument, DocMetadata } from "@/hooks/property/usePropertyDocuments";
import {
  StripMetricValue,
  summaryActionCol,
  summaryRowLabelClass,
} from "@/components/properties/propertySnapshotMetrics";

const DOC_TABS = ["OVERVIEW", "ATTENTION"] as const;
type DocTabIndex = 0 | 1;

interface DocumentHealthSummaryProps {
  propertyId: string;
  documents: PropertyDocument[];
  className?: string;
}

export function DocumentHealthSummary({
  propertyId,
  documents,
  className,
}: DocumentHealthSummaryProps) {
  const navigate = useNavigate();
  const { orgId } = useActiveOrg();
  const [activeTab, setActiveTab] = useState<DocTabIndex>(0);
  const docIds = documents.map((d) => d.id);

  const { data: linkedIds = new Set<string>() } = useQuery({
    queryKey: ["doc-health-linked", orgId, docIds.join(",")],
    queryFn: async () => {
      if (!orgId || docIds.length === 0) return new Set<string>();
      const [s, a, c] = await Promise.all([
        supabase.from("attachment_spaces").select("attachment_id").in("attachment_id", docIds).eq("org_id", orgId),
        supabase.from("attachment_assets").select("attachment_id").in("attachment_id", docIds).eq("org_id", orgId),
        supabase.from("attachment_compliance").select("attachment_id").in("attachment_id", docIds).eq("org_id", orgId),
      ]);
      const set = new Set<string>();
      [...(s.data || []), ...(a.data || []), ...(c.data || [])].forEach((r: { attachment_id: string }) =>
        set.add(r.attachment_id)
      );
      return set;
    },
    enabled: !!orgId && docIds.length > 0,
  });

  const today = new Date().toISOString().split("T")[0];
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);
  const in30DaysStr = in30Days.toISOString().split("T")[0];

  const expired = documents.filter((d) => d.expiry_date && d.expiry_date < today).length;
  const dueSoon = documents.filter(
    (d) => d.expiry_date && d.expiry_date >= today && d.expiry_date <= in30DaysStr
  ).length;

  const unlinked = documents.filter((d) => !linkedIds.has(d.id)).length;

  const withHazards = documents.filter((d) => {
    const meta = (d.metadata || {}) as DocMetadata;
    const h = meta.hazards;
    return Array.isArray(h) && h.length > 0;
  }).length;

  const total = documents.length;
  const expiryAttention = expired + dueSoon;

  const base = `/properties/${propertyId}/documents`;

  const go = (query: string) => navigate(query ? `${base}?${query}` : base);

  const rowClass =
    "group flex h-[30px] w-full cursor-pointer items-center gap-0 rounded-md py-0 pl-1 pr-0.5 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

  const overviewRows = useMemo(
    () =>
      [
        {
          key: "total",
          label: "Total documents",
          icon: FileText,
          onRowClick: () => go(""),
          metric: (
            <StripMetricValue
              primary={total}
              attention={expiryAttention}
              primaryMuted={total === 0}
              attentionTitle={
                expiryAttention > 0
                  ? `${expired} expired, ${dueSoon} due within 30 days`
                  : undefined
              }
              warnClassName="text-amber-600"
            />
          ),
          actions: (
            <div className={summaryActionCol}>
              <button
                type="button"
                aria-label="Upload document"
                className="flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/90 hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  go("upload=1");
                }}
              >
                <Upload className="h-3.5 w-3.5" />
              </button>
              <span
                className="flex h-6 w-6 items-center justify-center rounded-lg text-xs text-muted-foreground transition-colors hover:bg-white/90 hover:text-foreground"
                aria-hidden
              >
                →
              </span>
            </div>
          ),
        },
        {
          key: "expired",
          label: "Expired",
          icon: AlertCircle,
          onRowClick: () => go("filter=expired"),
          metric: (
            <StripMetricValue
              primary={expired}
              attention={0}
              primaryMuted={expired === 0}
              primaryClassName={expired > 0 ? "text-destructive" : undefined}
            />
          ),
          actions: (
            <div className={summaryActionCol}>
              <span
                className="flex h-6 w-6 items-center justify-center rounded-lg text-xs text-muted-foreground transition-colors hover:bg-white/90 hover:text-foreground"
                aria-hidden
              >
                →
              </span>
            </div>
          ),
        },
        {
          key: "dueSoon",
          label: "Due soon",
          icon: AlertTriangle,
          onRowClick: () => go("filter=expiring"),
          metric: (
            <StripMetricValue
              primary={dueSoon}
              attention={0}
              primaryMuted={dueSoon === 0}
              primaryClassName={dueSoon > 0 ? "text-amber-600" : undefined}
            />
          ),
          actions: (
            <div className={summaryActionCol}>
              <span
                className="flex h-6 w-6 items-center justify-center rounded-lg text-xs text-muted-foreground transition-colors hover:bg-white/90 hover:text-foreground"
                aria-hidden
              >
                →
              </span>
            </div>
          ),
        },
        {
          key: "unlinked",
          label: "Unlinked",
          icon: Link2,
          onRowClick: () => go("filter=unlinked"),
          metric: (
            <StripMetricValue primary={unlinked} attention={0} primaryMuted={unlinked === 0} />
          ),
          actions: (
            <div className={summaryActionCol}>
              <span
                className="flex h-6 w-6 items-center justify-center rounded-lg text-xs text-muted-foreground transition-colors hover:bg-white/90 hover:text-foreground"
                aria-hidden
              >
                →
              </span>
            </div>
          ),
        },
        {
          key: "hazards",
          label: "With hazards",
          icon: Shield,
          onRowClick: () => go("filter=hazards"),
          metric: (
            <StripMetricValue
              primary={withHazards}
              attention={0}
              primaryMuted={withHazards === 0}
              primaryClassName={withHazards > 0 ? "text-amber-600" : undefined}
            />
          ),
          actions: (
            <div className={summaryActionCol}>
              <span
                className="flex h-6 w-6 items-center justify-center rounded-lg text-xs text-muted-foreground transition-colors hover:bg-white/90 hover:text-foreground"
                aria-hidden
              >
                →
              </span>
            </div>
          ),
        },
      ] as const,
    [total, expired, dueSoon, unlinked, withHazards, expiryAttention]
  );

  const hasAttention =
    expired > 0 || dueSoon > 0 || unlinked > 0 || withHazards > 0;

  const attentionRows = useMemo(() => {
    return overviewRows.filter((r) => {
      if (r.key === "total") return true;
      if (r.key === "expired") return expired > 0;
      if (r.key === "dueSoon") return dueSoon > 0;
      if (r.key === "unlinked") return unlinked > 0;
      if (r.key === "hazards") return withHazards > 0;
      return false;
    });
  }, [overviewRows, expired, dueSoon, unlinked, withHazards]);

  return (
    <div
      className={cn(
        "rounded-[12px] overflow-hidden shadow-e1 bg-card/60 w-full flex flex-col min-h-0",
        className
      )}
    >
      <div className="px-3 pt-3 pb-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground font-mono">
          Health snapshot
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">What exists on this property</p>
      </div>

      <div className="relative z-10 flex shrink-0 justify-center items-center gap-0 pt-1 pb-[6px] px-[6px] bg-muted/20">
        {DOC_TABS.map((tab, idx) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(idx as DocTabIndex)}
            className={cn(
              "flex-1 rounded-[8px] h-6 flex items-center justify-center px-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide leading-none",
              "transition-[color,background-color,box-shadow] duration-200 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-0",
              activeTab === idx
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground/90 hover:bg-background/55"
            )}
            style={
              activeTab === idx
                ? {
                    backgroundColor: "rgba(255, 255, 255, 1)",
                    boxShadow:
                      "-1px -2px 2px 0px rgba(0, 0, 0, 0.16), -1px -1px 2px 0px rgba(255, 255, 255, 0.45)",
                  }
                : undefined
            }
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 px-0 pb-2">
        <div
          className={cn(
            "pl-1.5 pr-0 py-0.5 space-y-0.5 overflow-y-auto max-h-[220px]",
            activeTab === 0 ? "block" : "hidden"
          )}
          aria-hidden={activeTab !== 0}
        >
          {overviewRows.map((row) => {
            const Icon = row.icon;
            return (
              <div
                key={row.key}
                role="button"
                tabIndex={0}
                onClick={row.onRowClick}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    row.onRowClick();
                  }
                }}
                className={rowClass}
              >
                <span className={summaryRowLabelClass}>
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {row.label}
                </span>
                {row.metric}
                {row.actions}
              </div>
            );
          })}
        </div>

        <div
          className={cn(
            "pl-1.5 pr-0 py-0.5 space-y-0.5 overflow-y-auto max-h-[220px]",
            activeTab === 1 ? "block" : "hidden"
          )}
          aria-hidden={activeTab !== 1}
        >
          {total === 0 ? (
            <p className="text-xs text-muted-foreground py-2 px-1">No documents on this property yet.</p>
          ) : (
            <>
              {attentionRows.map((row) => {
                const Icon = row.icon;
                return (
                  <div
                    key={row.key}
                    role="button"
                    tabIndex={0}
                    onClick={row.onRowClick}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        row.onRowClick();
                      }
                    }}
                    className={rowClass}
                  >
                    <span className={summaryRowLabelClass}>
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {row.label}
                    </span>
                    {row.metric}
                    {row.actions}
                  </div>
                );
              })}
              {!hasAttention && (
                <p className="text-[10px] text-muted-foreground px-1 py-1.5 leading-snug">
                  Nothing needs attention right now.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
