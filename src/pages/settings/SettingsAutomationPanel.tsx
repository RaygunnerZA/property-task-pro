import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Zap, ChevronDown, ChevronUp, HelpCircle, Brain, Shield, Sparkles, ImageIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useOrgSettings, type AutomationMode, type AutoTaskLevel } from "@/hooks/useOrgSettings";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MODE_DESCRIPTIONS: Record<AutomationMode, string> = {
  conservative: "No auto-tasks. Only insights and recommendations. You must approve each action.",
  recommended: "Auto-create tasks for critical and high risk. Auto-assign when confidence is high.",
  aggressive: "Full autopilot. Auto-task all risk levels, auto-assign, auto-update schedules.",
};

const TASK_LEVELS: { value: AutoTaskLevel; label: string }[] = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "expiring_soon", label: "Expiring soon" },
  { value: "upcoming", label: "Upcoming" },
];

export default function SettingsAutomationPanel() {
  const queryClient = useQueryClient();
  const { orgId } = useActiveOrg();
  const { settings, updateSettings, isUpdating } = useOrgSettings();
  const [runningAutomation, setRunningAutomation] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [backfillingIcons, setBackfillingIcons] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    task: true,
    contractor: true,
    expiry: false,
    intelligence: false,
    spatial: false,
    brain: true,
  });

  const mode = (settings?.automation_mode ?? settings?.automation_aggressiveness ?? "recommended") as AutomationMode;
  const autoTaskLevels = settings?.auto_task_levels ?? (mode === "conservative" ? [] : mode === "recommended" ? ["critical", "high"] : ["critical", "high", "expiring_soon", "upcoming"]);

  const handleModeChange = async (next: AutomationMode) => {
    try {
      const defaults: Partial<typeof settings> = { automation_mode: next };
      if (next === "conservative") {
        defaults.auto_task_generation = false;
        defaults.auto_assign_contractors = false;
        defaults.auto_expiry_update = false;
      } else if (next === "recommended") {
        defaults.auto_task_generation = true;
        defaults.auto_task_levels = ["critical", "high"];
        defaults.auto_assign_contractors = true;
        defaults.auto_assign_confidence = 0.8;
        defaults.auto_expiry_update = true;
        defaults.auto_expiry_confidence = 0.85;
      } else {
        defaults.auto_task_generation = true;
        defaults.auto_task_levels = ["critical", "high", "expiring_soon", "upcoming"];
        defaults.auto_assign_contractors = true;
        defaults.auto_assign_confidence = 0.6;
        defaults.auto_expiry_update = true;
        defaults.auto_expiry_confidence = 0.6;
      }
      await updateSettings(defaults);
      toast.success(`Automation set to ${next}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    }
  };

  const toggleTaskLevel = async (level: AutoTaskLevel, checked: boolean) => {
    const current = settings?.auto_task_levels ?? [];
    const next = checked ? [...current, level] : current.filter((l) => l !== level);
    await updateSettings({ auto_task_levels: next.length ? next : null });
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Master Automation Mode Dial */}
        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Automation Mode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 p-1 bg-surface-gradient rounded-[8px] shadow-e1 sm:flex-row">
              {(["conservative", "recommended", "aggressive"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleModeChange(m)}
                  disabled={isUpdating}
                  className={cn(
                    "min-h-[44px] w-full min-w-0 flex-1 py-3 px-3 rounded-[6px] text-sm font-medium transition-all capitalize sm:px-4",
                    mode === m
                      ? "bg-card shadow-e1 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{MODE_DESCRIPTIONS[mode]}</p>
          </CardContent>
        </Card>

        {/* Granular Preference Groups */}
        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle>Granular Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* A. Task Generation */}
            <Collapsible open={openSections.task} onOpenChange={(o) => setOpenSections((s) => ({ ...s, task: o }))}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center justify-between w-full py-2 text-left font-medium">
                  Task Generation
                  {openSections.task ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <Label>Auto-create tasks</Label>
                  <Switch
                    checked={settings?.auto_task_generation ?? settings?.auto_task_creation ?? false}
                    disabled={isUpdating}
                    onCheckedChange={async (c) => {
                      await updateSettings({ auto_task_generation: c, auto_task_creation: c });
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  This action creates tasks automatically. You can always review them in the history log.
                </p>
                <div className="space-y-2">
                  <Label>Auto-create only for:</Label>
                  <div className="flex flex-wrap gap-4">
                    {TASK_LEVELS.map(({ value, label }) => (
                      <label key={value} className="flex items-center gap-2 cursor-pointer">
                        <Checkbox
                          checked={autoTaskLevels.includes(value)}
                          onCheckedChange={(c) => toggleTaskLevel(value, !!c)}
                          disabled={isUpdating}
                        />
                        <span className="text-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* B. Contractor Assignment */}
            <Collapsible open={openSections.contractor} onOpenChange={(o) => setOpenSections((s) => ({ ...s, contractor: o }))}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center justify-between w-full py-2 text-left font-medium">
                  Contractor Assignment
                  {openSections.contractor ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <Label>Assign contractors automatically</Label>
                  <Switch
                    checked={settings?.auto_assign_contractors ?? settings?.auto_assignment ?? false}
                    disabled={isUpdating}
                    onCheckedChange={async (c) => {
                      await updateSettings({ auto_assign_contractors: c, auto_assignment: c });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Minimum confidence for assignment</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>Only assign when contractor match confidence meets this threshold.</TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <Slider
                      value={[Math.round((settings?.auto_assign_confidence ?? 0.8) * 100)]}
                      min={50}
                      max={95}
                      step={5}
                      onValueChange={async ([v]) => {
                        await updateSettings({ auto_assign_confidence: v / 100 });
                      }}
                      disabled={isUpdating}
                      className="flex-1"
                    />
                    <span className="text-sm w-12">{(settings?.auto_assign_confidence ?? 0.8) * 100}%</span>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* C. Expiry & Schedule Updates */}
            <Collapsible open={openSections.expiry} onOpenChange={(o) => setOpenSections((s) => ({ ...s, expiry: o }))}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center justify-between w-full py-2 text-left font-medium">
                  Expiry & Schedule Updates
                  {openSections.expiry ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <Label>Allow AI to update expiry and next due date</Label>
                  <Switch
                    checked={settings?.auto_expiry_update ?? false}
                    disabled={isUpdating}
                    onCheckedChange={async (c) => updateSettings({ auto_expiry_update: c })}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Minimum confidence for expiry updates</Label>
                    <Tooltip>
                      <TooltipTrigger>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>Never overwrite expiry dates with low confidence.</TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <Slider
                      value={[Math.round((settings?.auto_expiry_confidence ?? 0.85) * 100)]}
                      min={50}
                      max={95}
                      step={5}
                      onValueChange={async ([v]) => updateSettings({ auto_expiry_confidence: v / 100 })}
                      disabled={isUpdating}
                      className="flex-1"
                    />
                    <span className="text-sm w-12">{(settings?.auto_expiry_confidence ?? 0.85) * 100}%</span>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* D. Compliance Document Intelligence */}
            <Collapsible open={openSections.intelligence} onOpenChange={(o) => setOpenSections((s) => ({ ...s, intelligence: o }))}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center justify-between w-full py-2 text-left font-medium">
                  Document Intelligence
                  {openSections.intelligence ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <p className="text-sm text-muted-foreground">
                  Hazards auto-classify risk level. AI proposes recommended actions. Low-risk items can be auto-dismissed.
                </p>
              </CollapsibleContent>
            </Collapsible>

            {/* E. Spatial & Asset Linking */}
            <Collapsible open={openSections.spatial} onOpenChange={(o) => setOpenSections((s) => ({ ...s, spatial: o }))}>
              <CollapsibleTrigger asChild>
                <button className="flex items-center justify-between w-full py-2 text-left font-medium">
                  Spatial & Asset Linking
                  {openSections.spatial ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <Label>Auto-link to assets when confidence ≥ threshold</Label>
                  <Switch
                    checked={settings?.auto_link_assets ?? false}
                    disabled={isUpdating}
                    onCheckedChange={async (c) => updateSettings({ auto_link_assets: c })}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <Slider
                    value={[Math.round((settings?.auto_link_asset_confidence ?? 0.75) * 100)]}
                    min={50}
                    max={95}
                    step={5}
                    onValueChange={async ([v]) => updateSettings({ auto_link_asset_confidence: v / 100 })}
                    disabled={isUpdating}
                    className="flex-1"
                  />
                  <span className="text-sm w-12">{(settings?.auto_link_asset_confidence ?? 0.75) * 100}%</span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <Label>Auto-link to spaces when confidence ≥ threshold</Label>
                  <Switch
                    checked={settings?.auto_link_spaces ?? false}
                    disabled={isUpdating}
                    onCheckedChange={async (c) => updateSettings({ auto_link_spaces: c })}
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <Slider
                    value={[Math.round((settings?.auto_link_space_confidence ?? 0.7) * 100)]}
                    min={50}
                    max={95}
                    step={5}
                    onValueChange={async ([v]) => updateSettings({ auto_link_space_confidence: v / 100 })}
                    disabled={isUpdating}
                    className="flex-1"
                  />
                  <span className="text-sm w-12">{(settings?.auto_link_space_confidence ?? 0.7) * 100}%</span>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        {/* Phase 11: AI Preferences (Filla Brain) */}
        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted/30 p-3 flex items-start gap-2">
              <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Filla Brain never receives identifying data, documents, addresses, or images. Only anonymised patterns are shared.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Automated Intelligence</Label>
              <Select
                value={settings?.automated_intelligence ?? "suggestions_only"}
                onValueChange={async (v: "off" | "suggestions_only" | "auto_draft" | "auto_create" | "full_automation") =>
                  updateSettings({ automated_intelligence: v })
                }
                disabled={isUpdating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="off">Off</SelectItem>
                  <SelectItem value="suggestions_only">Suggestions only</SelectItem>
                  <SelectItem value="auto_draft">Auto-draft actions</SelectItem>
                  <SelectItem value="auto_create">Auto-create tasks</SelectItem>
                  <SelectItem value="full_automation">Full automation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prediction Aggressiveness</Label>
              <Select
                value={settings?.prediction_aggressiveness ?? "recommended"}
                onValueChange={async (v: "conservative" | "recommended" | "aggressive") =>
                  updateSettings({ prediction_aggressiveness: v })
                }
                disabled={isUpdating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conservative">Conservative</SelectItem>
                  <SelectItem value="recommended">Recommended</SelectItem>
                  <SelectItem value="aggressive">Aggressive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Hazard Sensitivity</Label>
              <Select
                value={settings?.hazard_sensitivity ?? "medium"}
                onValueChange={async (v: "low" | "medium" | "high") =>
                  updateSettings({ hazard_sensitivity: v })
                }
                disabled={isUpdating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data Sharing Level</Label>
              <Select
                value={settings?.data_sharing_level ?? "standard"}
                onValueChange={async (v: "minimal" | "standard" | "full_anonymised") =>
                  updateSettings({ data_sharing_level: v })
                }
                disabled={isUpdating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minimal">Minimal — basic vectors</SelectItem>
                  <SelectItem value="standard">Standard — include hazard patterns</SelectItem>
                  <SelectItem value="full_anonymised">Full anonymised — best learning</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Never shares private data. Only anonymised signals.</p>
            </div>

            {/* Phase 12F: Icon Automation Options */}
            <div className="pt-4 border-t border-border space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <Label className="text-base font-medium">Icon Automation</Label>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <Label>Enable AI icon suggestions</Label>
                <Switch
                  checked={settings?.ai_icon_suggestions ?? true}
                  disabled={isUpdating}
                  onCheckedChange={async (c) => updateSettings({ ai_icon_suggestions: c })}
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <Label>Allow AI to override icons</Label>
                <Switch
                  checked={settings?.ai_icon_override ?? false}
                  disabled={isUpdating}
                  onCheckedChange={async (c) => updateSettings({ ai_icon_override: c })}
                />
              </div>
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select
                  value={settings?.ai_icon_mode ?? "recommended"}
                  onValueChange={async (v: "conservative" | "recommended" | "aggressive") =>
                    updateSettings({ ai_icon_mode: v })
                  }
                  disabled={isUpdating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">Conservative — manual unless certain</SelectItem>
                    <SelectItem value="recommended">Recommended — balanced</SelectItem>
                    <SelectItem value="aggressive">Aggressive — auto-apply for high confidence</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prefer</Label>
                <Select
                  value={settings?.ai_icon_prefer ?? "global"}
                  onValueChange={async (v: "global" | "local" | "fallback") =>
                    updateSettings({ ai_icon_prefer: v })
                  }
                  disabled={isUpdating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Learned global patterns</SelectItem>
                    <SelectItem value="local">Local org defaults</SelectItem>
                    <SelectItem value="fallback">Fallback when unsure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fallback when unsure</Label>
                <Select
                  value={settings?.ai_icon_fallback ?? "wrench"}
                  onValueChange={async (v: "wrench" | "file-text" | "circle" | "empty") =>
                    updateSettings({ ai_icon_fallback: v })
                  }
                  disabled={isUpdating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wrench">Generic tool (wrench)</SelectItem>
                    <SelectItem value="file-text">Generic document (file-text)</SelectItem>
                    <SelectItem value="circle">Circle</SelectItem>
                    <SelectItem value="empty">Empty</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={backfillingIcons}
                  onClick={async () => {
                    setBackfillingIcons(true);
                    try {
                      const { data, error } = await supabase.rpc("backfill_entity_icons");
                      if (error) throw error;
                      const assets = (data as { assets_updated?: number })?.assets_updated ?? 0;
                      const spaces = (data as { spaces_updated?: number })?.spaces_updated ?? 0;
                      queryClient.invalidateQueries({ queryKey: ["assets"] });
                      queryClient.invalidateQueries({ queryKey: ["spaces"] });
                      toast.success(`Icons updated: ${assets} assets, ${spaces} spaces (e.g. toilet → toilet icon)`);
                    } catch (err: any) {
                      toast.error(err.message || "Failed to backfill icons");
                    } finally {
                      setBackfillingIcons(false);
                    }
                  }}
                >
                  {backfillingIcons ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <ImageIcon className="mr-2 h-4 w-4" />
                      Backfill icons for assets & spaces
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Phase 11: Contribute to Filla Brain */}
        <Button
          variant="outline"
          disabled={extracting || !orgId}
          onClick={async () => {
            if (!orgId) return;
            setExtracting(true);
            try {
              const { data, error } = await supabase.functions.invoke("local-to-global-extractor", {
                body: { org_id: orgId },
              });
              if (error) throw error;
              const extracted = data?.extracted ?? {};
              const total = typeof extracted === "number" ? extracted : (extracted.assets ?? 0) + (extracted.compliance ?? 0) + (extracted.hazards ?? 0);
              toast.success(`Contributed ${total} anonymised signals to Filla Brain.`);
            } catch (err: any) {
              toast.error(err.message || "Failed to contribute");
            } finally {
              setExtracting(false);
            }
          }}
        >
          {extracting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Brain className="mr-2 h-4 w-4" />
              Contribute to Filla Brain
            </>
          )}
        </Button>

        {/* Run automation now */}
        <Button
          variant="outline"
          disabled={runningAutomation || !orgId}
          onClick={async () => {
            if (!orgId) return;
            setRunningAutomation(true);
            try {
              const { data, error } = await supabase.functions.invoke("compliance-auto-engine", {
                body: { org_id: orgId },
              });
              if (error) throw error;
              const results = data?.results ?? {};
              const total = Object.values(results).reduce((s: number, r: any) => s + (r?.created ?? 0), 0);
              toast.success(`Automation complete. ${total} task(s) created.`);
            } catch (err: any) {
              toast.error(err.message || "Failed to run automation");
            } finally {
              setRunningAutomation(false);
            }
          }}
        >
          {runningAutomation ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Run automation now
            </>
          )}
        </Button>
      </div>
    </TooltipProvider>
  );
}
