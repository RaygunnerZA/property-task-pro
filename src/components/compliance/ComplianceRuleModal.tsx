/**
 * ComplianceRuleModal
 *
 * Single modal for creating and editing compliance_rules.
 * Sections: Basic | Frequency | Scope | Automation
 *
 * Used from: ComplianceRulesSection (Add Rule button + Edit in row three-dot menu)
 */

import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useUpsertComplianceRule,
  type ComplianceRuleFormValues,
} from "@/hooks/useUpsertComplianceRule";
import { FREQUENCY_OPTIONS } from "@/services/propertyIntelligence/frequencyUtils";
import type { ComplianceRuleWithStatus } from "@/hooks/useComplianceRules";

type ScopeType = "property" | "asset_type" | "specific_assets";

interface ComplianceRuleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  /** When provided, modal is in edit mode */
  editRule?: ComplianceRuleWithStatus | null;
}

const DEFAULT_FORM: ComplianceRuleFormValues = {
  name: "",
  description: "",
  frequency: "annual",
  scope_type: "property",
  scope_asset_type: "",
  auto_create: false,
  template_config: {
    title_template: "",
    default_priority: "medium",
  },
  notify_days_before: 30,
};

function formFromRule(rule: ComplianceRuleWithStatus): ComplianceRuleFormValues {
  const tc = rule.template_config as Record<string, string> | null;
  return {
    name: rule.name ?? "",
    description: rule.description ?? "",
    frequency: rule.frequency ?? "annual",
    scope_type: (rule.scope_type as ScopeType) ?? "property",
    scope_asset_type: rule.scope_asset_type ?? "",
    auto_create: rule.auto_create,
    template_config: tc
      ? {
          title_template: String(tc.title_template ?? ""),
          default_priority: String(tc.default_priority ?? "medium"),
          assigned_user_id: tc.assigned_user_id
            ? String(tc.assigned_user_id)
            : undefined,
        }
      : { title_template: "", default_priority: "medium" },
    notify_days_before: rule.notify_days_before ?? 30,
  };
}

export function ComplianceRuleModal({
  open,
  onOpenChange,
  propertyId,
  editRule,
}: ComplianceRuleModalProps) {
  const isEdit = !!editRule;
  const upsert = useUpsertComplianceRule();

  const [form, setForm] = useState<ComplianceRuleFormValues>(DEFAULT_FORM);

  // Sync form when rule changes (edit mode)
  useEffect(() => {
    if (editRule) {
      setForm(formFromRule(editRule));
    } else {
      setForm(DEFAULT_FORM);
    }
  }, [editRule, open]);

  const set = <K extends keyof ComplianceRuleFormValues>(
    key: K,
    value: ComplianceRuleFormValues[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const setTemplateConfig = (
    key: keyof NonNullable<ComplianceRuleFormValues["template_config"]>,
    value: string
  ) =>
    setForm((prev) => ({
      ...prev,
      template_config: { ...prev.template_config, [key]: value },
    }));

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    await upsert.mutateAsync({
      propertyId,
      ruleId: editRule?.id,
      values: form,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            {isEdit ? "Edit Compliance Rule" : "New Compliance Rule"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* ── Basic ───────────────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Basic
            </h3>
            <div className="space-y-1.5">
              <Label htmlFor="rule-name">Rule name *</Label>
              <Input
                id="rule-name"
                placeholder="e.g. Fire Risk Assessment"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-description">Description</Label>
              <Textarea
                id="rule-description"
                placeholder="Why this rule exists, legal context…"
                value={form.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
          </section>

          {/* ── Frequency ───────────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Frequency
            </h3>
            <div className="space-y-1.5">
              <Label htmlFor="rule-frequency">How often</Label>
              <Select
                value={form.frequency}
                onValueChange={(v) => set("frequency", v)}
              >
                <SelectTrigger id="rule-frequency">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-notify">Notify days before due</Label>
              <Input
                id="rule-notify"
                type="number"
                min={1}
                max={365}
                value={form.notify_days_before ?? 30}
                onChange={(e) =>
                  set("notify_days_before", Number(e.target.value))
                }
                className="w-32"
              />
            </div>
          </section>

          {/* ── Scope ───────────────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Scope
            </h3>
            <div className="space-y-2">
              {(
                [
                  { value: "property", label: "Entire property" },
                  { value: "asset_type", label: "Specific asset type" },
                ] as { value: ScopeType; label: string }[]
              ).map(({ value, label }) => (
                <label
                  key={value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="scope_type"
                    checked={form.scope_type === value}
                    onChange={() => set("scope_type", value)}
                    className="accent-primary"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
            {form.scope_type === "asset_type" && (
              <div className="space-y-1.5">
                <Label htmlFor="rule-asset-type">Asset type</Label>
                <Input
                  id="rule-asset-type"
                  placeholder="e.g. Passenger Lift, Boiler"
                  value={form.scope_asset_type ?? ""}
                  onChange={(e) => set("scope_asset_type", e.target.value)}
                />
              </div>
            )}
          </section>

          {/* ── Automation ──────────────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Automation
            </h3>
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={form.auto_create}
                onCheckedChange={(v) => set("auto_create", !!v)}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium">Auto-create task when due</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  A task will be created automatically when this compliance item
                  becomes due
                </p>
              </div>
            </label>

            {form.auto_create && (
              <div className="ml-6 space-y-3 pt-1 border-l-2 border-primary/20 pl-4">
                <div className="space-y-1.5">
                  <Label htmlFor="rule-task-title">Task title prefix</Label>
                  <Input
                    id="rule-task-title"
                    placeholder="e.g. Annual LOLER Inspection"
                    value={form.template_config?.title_template ?? ""}
                    onChange={(e) =>
                      setTemplateConfig("title_template", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rule-task-priority">Default priority</Label>
                  <Select
                    value={form.template_config?.default_priority ?? "medium"}
                    onValueChange={(v) =>
                      setTemplateConfig("default_priority", v)
                    }
                  >
                    <SelectTrigger id="rule-task-priority" className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={upsert.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={upsert.isPending || !form.name.trim()}
          >
            {upsert.isPending
              ? "Saving…"
              : isEdit
              ? "Save changes"
              : "Add rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
