/**
 * Document Health Summary — Phase 5
 * Shows document counts and links to filtered Property Documents view
 */

import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileText, AlertCircle, AlertTriangle, Link2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import type { PropertyDocument, DocMetadata } from "@/hooks/property/usePropertyDocuments";

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

  const expired = documents.filter(
    (d) => d.expiry_date && d.expiry_date < today
  ).length;
  const dueSoon = documents.filter(
    (d) =>
      d.expiry_date &&
      d.expiry_date >= today &&
      d.expiry_date <= in30DaysStr
  ).length;

  const unlinked = documents.filter((d) => !linkedIds.has(d.id)).length;

  const withHazards = documents.filter((d) => {
    const meta = (d.metadata || {}) as DocMetadata;
    const h = meta.hazards;
    return Array.isArray(h) && h.length > 0;
  }).length;

  const total = documents.length;
  const items = [
    { label: "Total documents", value: total, icon: FileText, filter: null },
    {
      label: "Expired",
      value: expired,
      icon: AlertCircle,
      filter: "expired",
      color: "text-destructive",
    },
    {
      label: "Due soon",
      value: dueSoon,
      icon: AlertTriangle,
      filter: "expiring",
      color: "text-amber-600",
    },
    {
      label: "Unlinked",
      value: unlinked,
      icon: Link2,
      filter: "unlinked",
    },
    {
      label: "With hazards",
      value: withHazards,
      icon: Shield,
      filter: "hazards",
      color: withHazards > 0 ? "text-amber-600" : undefined,
    },
  ];

  return (
    <div className={cn("rounded-lg bg-white/60 p-4 shadow-e1", className)}>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() =>
                item.filter
                  ? navigate(`/properties/${propertyId}/documents?filter=${item.filter}`)
                  : navigate(`/properties/${propertyId}/documents`)
              }
              className={cn(
                "flex flex-col items-center gap-[9px] px-3 py-4 rounded-lg",
                "hover:bg-muted/50 transition-colors text-left",
                item.color
              )}
            >
              <span className="text-[38px] font-bold">{item.value}</span>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Icon className="h-3 w-3" />
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
