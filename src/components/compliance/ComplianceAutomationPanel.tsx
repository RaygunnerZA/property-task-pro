/**
 * ComplianceAutomationPanel
 *
 * Replaces the static Automation Status card in PropertyCompliance.tsx.
 * Provides live toggle controls for automation settings.
 *
 * Reads from: useOrgSettings (for the three toggles)
 * Also reads: useComplianceRules (for "X of Y rules automated" summary)
 */

import { Bot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useOrgSettings } from "@/hooks/useOrgSettings";
import { useComplianceRules } from "@/hooks/useComplianceRules";

interface ComplianceAutomationPanelProps {
  propertyId: string;
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
        className="shrink-0 mt-0.5"
      />
    </div>
  );
}

export function ComplianceAutomationPanel({
  propertyId,
}: ComplianceAutomationPanelProps) {
  const { settings, updateSettings, isUpdating } = useOrgSettings();
  const { data: rules = [] } = useComplianceRules(propertyId);

  const automatedRuleCount = rules.filter((r) => r.auto_create).length;

  return (
    <Card className="shadow-e1">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          Automation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ToggleRow
          label="Auto-create compliance tasks"
          description="Automatically create tasks when compliance items become due"
          checked={settings?.auto_task_creation ?? false}
          onChange={(v) => updateSettings({ auto_task_creation: v })}
          disabled={isUpdating}
        />
        <ToggleRow
          label="Notify managers on overdue"
          description="Send alerts when compliance items pass their due date"
          checked={settings?.auto_schedule_compliance ?? false}
          onChange={(v) => updateSettings({ auto_schedule_compliance: v })}
          disabled={isUpdating}
        />
        <ToggleRow
          label="Auto-assign by contractor"
          description="Automatically assign compliance tasks to linked contractors"
          checked={settings?.auto_assign_contractors ?? false}
          onChange={(v) => updateSettings({ auto_assign_contractors: v })}
          disabled={isUpdating}
        />

        {rules.length > 0 && (
          <div className="pt-2 border-t border-border/40">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {automatedRuleCount}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">{rules.length}</span>{" "}
              rule{rules.length !== 1 ? "s" : ""} automated
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
