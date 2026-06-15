import type { AttentionItem } from "@/components/dashboard/issues/issuesAttentionItem";
import type { SignalKind } from "@/types/workbenchSignals";
import { SIGNAL_KIND_FOOT_LABEL } from "@/types/workbenchSignals";
import type { SignalRow } from "@/lib/signals/signalTypes";

function dispositionToGroup(
  disposition: string,
  severity: string
): AttentionItem["group"] {
  if (disposition === "urgent" || severity === "critical" || severity === "urgent") {
    return "urgent";
  }
  if (disposition === "needs_review") return "review";
  return "recent";
}

function mapKind(kind: string): SignalKind {
  const allowed: SignalKind[] = [
    "message", "email", "upload", "ai_warning", "ai_suggestion",
    "admin", "conflict", "weather", "document", "system",
  ];
  return allowed.includes(kind as SignalKind) ? (kind as SignalKind) : "system";
}

function categoryTag(category: string): string {
  const map: Record<string, string> = {
    environmental: "Environmental",
    location: "Location",
    property: "Property",
    compliance: "Compliance",
    operational: "Operational",
  };
  return map[category] ?? "Signal";
}

export function mapSignalRowToAttentionItem(
  row: SignalRow,
  propertyName?: string
): AttentionItem {
  const group = dispositionToGroup(row.disposition, row.severity);
  const kind = mapKind(row.kind);
  const rec = row.recommendation;
  const action = rec?.action as string | undefined;
  const canCreateTask = action === "create_task";

  const isExternalEmail = row.subtype === "ingestion.external_email";
  const emailFrom = isExternalEmail ? String(row.payload?.from ?? "") : "";
  const emailSubject = isExternalEmail ? String(row.payload?.subject ?? row.title) : row.title;

  const context = isExternalEmail
    ? emailFrom
      ? `From ${emailFrom}`
      : "External email"
    : propertyName
      ? `${propertyName} • ${row.source.replace(/_/g, " ")}`
      : row.source.replace(/_/g, " ");

  return {
    id: `signal-${row.id}`,
    signalId: row.id,
    group,
    title: isExternalEmail ? emailSubject : row.title,
    context,
    description: isExternalEmail
      ? String(row.payload?.preview ?? row.body ?? "")
      : row.body ?? undefined,
    signalKind: kind,
    footChipLabel: group === "review" ? undefined : SIGNAL_KIND_FOOT_LABEL[kind],
    categoryTag: categoryTag(row.category),
    occurredAt: new Date(row.created_at).getTime(),
    recommendation: row.recommendation ?? undefined,
    signalSubtype: row.subtype,
    signalPayload: isExternalEmail ? row.payload : undefined,
    whyHere: isExternalEmail
      ? "This email came from an address that is not a member of your organisation."
      : undefined,
    fixtureActions: {
      primary: {
        id: canCreateTask ? "signal-accept" : "signal-open",
        label: canCreateTask ? "Create task" : "Review",
      },
      secondary: [
        { id: "signal-snooze", label: "Snooze" },
        { id: "dismiss", label: "Dismiss" },
      ],
    },
  };
}
