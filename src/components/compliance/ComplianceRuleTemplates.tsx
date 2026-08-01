/**
 * Context + starter templates for property compliance rules setup.
 */

import { Flame, Plus, Shield, Zap, Droplets } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PanelSectionTitle } from "@/components/ui/panel-section-title";
import { StarterTemplateCallout, RegulatedAreaBadge } from "@/components/templates/StarterTemplateCallout";
import { STARTER_TEMPLATE_SUMMARY } from "@/lib/starterTemplateDisclaimer";
import { formatFrequency } from "@/services/propertyIntelligence/frequencyUtils";
import {
  COMPLIANCE_RULE_TEMPLATES,
  type ComplianceRuleTemplate,
} from "@/data/complianceRuleTemplates";
import { cn } from "@/lib/utils";

const COMPLIANCE_RULES_ILLUSTRATION = "/compliance/compliance-rules.png";

const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  "rule-gas-safety": Flame,
  "rule-fire-risk": Shield,
  "rule-eicr": Zap,
  "rule-legionella": Droplets,
};

interface ComplianceRulesContextProps {
  className?: string;
}

/** Explains what a rule is and shows concrete examples. */
export function ComplianceRulesContext({ className }: ComplianceRulesContextProps) {
  return (
    <div className={cn("rounded-xl bg-card shadow-e1 px-4 py-3.5", className)}>
      <div className="grid gap-4 sm:grid-cols-[7fr_3fr] sm:items-start sm:gap-5">
        <div className="min-w-0 space-y-3">
          <div className="space-y-1.5">
            <PanelSectionTitle as="h2" className="mb-0">
              What is a compliance rule?
            </PanelSectionTitle>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A rule is a recurring obligation for this property — how often it is due, when to
              remind you, and whether Filla should create a task automatically. Certificates and
              uploads stay in Records; rules define the schedule behind them.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-caption font-mono uppercase tracking-wider text-muted-foreground">
              Examples
            </p>
            <ul className="space-y-1">
              {COMPLIANCE_RULE_TEMPLATES.map((t) => (
                <li key={t.id} className="text-sm text-muted-foreground flex gap-2">
                  <span className="text-primary shrink-0" aria-hidden>
                    ·
                  </span>
                  <span>{t.example}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-[200px] items-center justify-center sm:mx-0 sm:max-w-none sm:pt-0.5">
          <img
            src={COMPLIANCE_RULES_ILLUSTRATION}
            alt=""
            width={280}
            height={240}
            className="h-auto w-full object-contain"
            decoding="async"
          />
        </div>
      </div>
    </div>
  );
}

interface ComplianceRuleTemplatePickerProps {
  templates: ComplianceRuleTemplate[];
  onSelect: (template: ComplianceRuleTemplate) => void;
  addingId?: string | null;
  className?: string;
}

/** Easy default templates — opens the rule modal pre-filled for review. */
export function ComplianceRuleTemplatePicker({
  templates,
  onSelect,
  addingId = null,
  className,
}: ComplianceRuleTemplatePickerProps) {
  if (templates.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-1">
        <PanelSectionTitle as="h3" className="mb-0">
          Start from a template
        </PanelSectionTitle>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {STARTER_TEMPLATE_SUMMARY}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {templates.map((template) => {
          const Icon = TEMPLATE_ICONS[template.id] ?? Shield;
          const busy = addingId === template.id;

          return (
            <button
              key={template.id}
              type="button"
              disabled={busy}
              onClick={() => onSelect(template)}
              className={cn(
                "group text-left rounded-xl bg-card shadow-e1 px-3.5 py-3",
                "transition-all duration-150 hover:shadow-md hover:-translate-y-px",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                "disabled:opacity-60 disabled:pointer-events-none"
              )}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 rounded-lg bg-primary/10 p-1.5 shrink-0">
                  <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground leading-snug">
                      {template.name}
                    </p>
                    <span className="inline-flex items-center gap-0.5 shrink-0 text-caption font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus className="h-3 w-3" aria-hidden />
                      Use
                    </span>
                  </div>
                  <p className="text-caption text-muted-foreground leading-relaxed">
                    {template.summary}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-mono uppercase tracking-wider bg-primary/10 text-primary-deep">
                      {formatFrequency(template.frequency)}
                    </span>
                    {template.isRegulatedArea && <RegulatedAreaBadge />}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <StarterTemplateCallout variant="compact" />
    </div>
  );
}

interface ComplianceRulesEmptyWithTemplatesProps {
  templates: ComplianceRuleTemplate[];
  onSelectTemplate: (template: ComplianceRuleTemplate) => void;
  onAddCustom: () => void;
}

/** Empty-state block: copy + templates + custom CTA. */
export function ComplianceRulesEmptyWithTemplates({
  templates,
  onSelectTemplate,
  onAddCustom,
}: ComplianceRulesEmptyWithTemplatesProps) {
  return (
    <div className="rounded-card bg-card shadow-e1 p-5 space-y-5">
      <div className="text-center space-y-1.5">
        <Shield className="h-9 w-9 text-muted-foreground mx-auto" aria-hidden />
        <PanelSectionTitle as="h3" className="mb-0">
          No compliance rules yet
        </PanelSectionTitle>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Pick a common starting template, or add a custom rule for this property.
        </p>
      </div>

      <ComplianceRuleTemplatePicker
        templates={templates}
        onSelect={onSelectTemplate}
      />

      <div className="flex justify-center pt-1">
        <Button variant="outline" size="sm" onClick={onAddCustom} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add custom rule
        </Button>
      </div>
    </div>
  );
}
