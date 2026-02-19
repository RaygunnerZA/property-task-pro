/**
 * ComplianceRuleRow
 *
 * Displays a single compliance_rules record.
 * Shows: name, frequency badge, scope label, auto-create toggle,
 *        last completed date, next due date, status badge.
 * Three-dot menu: Edit (Sprint 3), Archive, Delete.
 */

import { format, parseISO, isValid } from "date-fns";
import { useState } from "react";
import {
  Archive,
  CheckCircle2,
  Clock,
  MoreHorizontal,
  Pencil,
  Shield,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { formatFrequency } from "@/services/propertyIntelligence/frequencyUtils";
import type { ComplianceRuleWithStatus } from "@/hooks/useComplianceRules";

interface ComplianceRuleRowProps {
  rule: ComplianceRuleWithStatus;
  /** Callback to open the edit modal (Sprint 3) */
  onEdit?: (rule: ComplianceRuleWithStatus) => void;
}

function StatusBadge({ status }: { status: ComplianceRuleWithStatus["status"] }) {
  switch (status) {
    case "overdue":
      return (
        <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40 bg-destructive/10">
          Overdue
        </Badge>
      );
    case "due_soon":
      return (
        <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          Due soon
        </Badge>
      );
    case "scheduled":
      return (
        <Badge variant="outline" className="text-[10px] text-success border-success/40 bg-success/10">
          Scheduled
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[10px] text-muted-foreground">
          No date
        </Badge>
      );
  }
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const parsed = parseISO(dateStr);
  return isValid(parsed) ? format(parsed, "d MMM yyyy") : null;
}

export function ComplianceRuleRow({ rule, onEdit }: ComplianceRuleRowProps) {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();
  const [toggling, setToggling] = useState(false);

  const scopeLabel =
    rule.scope_type === "asset_type" && rule.scope_asset_type
      ? `Asset: ${rule.scope_asset_type}`
      : rule.scope_type === "specific_assets"
      ? "Specific assets"
      : "Entire property";

  const handleAutoCreateToggle = async (checked: boolean) => {
    if (!orgId) return;
    setToggling(true);
    try {
      await supabase
        .from("compliance_rules")
        .update({ auto_create: checked })
        .eq("id", rule.id);
      queryClient.invalidateQueries({
        queryKey: ["compliance_rules", orgId, rule.property_id],
      });
    } finally {
      setToggling(false);
    }
  };

  const handleArchive = async () => {
    if (!orgId) return;
    await supabase
      .from("compliance_rules")
      .update({ is_archived: true })
      .eq("id", rule.id);
    queryClient.invalidateQueries({
      queryKey: ["compliance_rules", orgId, rule.property_id],
    });
  };

  const handleDelete = async () => {
    if (!orgId) return;
    await supabase.from("compliance_rules").delete().eq("id", rule.id);
    queryClient.invalidateQueries({
      queryKey: ["compliance_rules", orgId, rule.property_id],
    });
  };

  return (
    <div
      className={cn(
        "rounded-[8px] bg-card shadow-e1 border border-border/50",
        "p-4 flex flex-col gap-3"
      )}
    >
      {/* Top row: name + status badge + menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Shield className="h-4 w-4 text-primary shrink-0" />
          <span className="font-semibold text-sm text-foreground truncate">
            {rule.name ?? "Unnamed rule"}
          </span>
          <Badge variant="secondary" className="text-[10px]">
            {formatFrequency(rule.frequency ?? "annual")}
          </Badge>
          <StatusBadge status={rule.status} />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="p-1 rounded-[4px] hover:bg-muted/60 transition-colors text-muted-foreground"
              aria-label="Rule options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              onClick={() => onEdit?.(rule)}
              disabled={!onEdit}
              className="gap-2"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleArchive} className="gap-2">
              <Archive className="h-3.5 w-3.5" />
              Archive
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDelete}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Meta row: scope, dates */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Shield className="h-3 w-3" />
          {scopeLabel}
        </span>
        {rule.last_completed_at && (
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-success" />
            Last done {formatDate(rule.last_completed_at)}
          </span>
        )}
        {rule.next_due_date && (
          <span
            className={cn(
              "flex items-center gap-1",
              rule.status === "overdue" && "text-destructive",
              rule.status === "due_soon" && "text-amber-600"
            )}
          >
            <Clock className="h-3 w-3" />
            {rule.status === "overdue" ? "Was due" : "Due"}{" "}
            {formatDate(rule.next_due_date)}
            {rule.daysUntilDue !== null && (
              <span>
                {rule.daysUntilDue < 0
                  ? ` (${Math.abs(rule.daysUntilDue)}d overdue)`
                  : ` (${rule.daysUntilDue}d)`}
              </span>
            )}
          </span>
        )}
      </div>

      {/* Auto-create toggle */}
      <div className="flex items-center justify-between pt-1 border-t border-border/30">
        <span className="text-xs text-muted-foreground">
          Auto-create task when due
        </span>
        <Switch
          checked={rule.auto_create}
          onCheckedChange={handleAutoCreateToggle}
          disabled={toggling}
          aria-label="Auto-create task toggle"
        />
      </div>
    </div>
  );
}
