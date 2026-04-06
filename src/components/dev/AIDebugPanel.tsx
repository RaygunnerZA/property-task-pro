/**
 * AI Debug Panel — Dev-only introspection tool
 *
 * Displays:
 *   - Raw chip suggestion scores
 *   - PropertyProfile object
 *   - Evaluated compliance rules
 *   - AI extraction output
 *   - CreateTask parsing result
 *   - Rule boosts applied
 *   - Final chip ranking
 *   - Performance metrics
 *
 * Production safety: returns null outside dev mode.
 */

import { useState, useEffect, useCallback } from "react";
import { useDevMode } from "@/context/useDevMode";
import { isDevBuild } from "@/context/DevModeContext";
import { useDevEmbedLayout } from "@/hooks/useDevEmbedLayout";
import {
  simulateCreateTask,
  evaluateProfileDiagnostics,
  type CreateTaskSimulationResult,
} from "@/services/dev/simulateCreateTask";
import {
  getPerfEntries,
  getAggregatedMetrics,
  clearPerfEntries,
  subscribePerfEntries,
} from "@/services/dev/performanceMetrics";
import { normalizePropertyProfile } from "@/services/propertyIntelligence/ruleEvaluator";
import type { PropertyProfile } from "@/services/propertyIntelligence/types";
import {
  X,
  Play,
  Trash2,
  ChevronDown,
  ChevronRight,
  Gauge,
  Brain,
  FileSearch,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function AIDebugPanel() {
  const devEmbed = useDevEmbedLayout();
  const devMode = useDevMode();

  if (!isDevBuild) return null;
  if (devEmbed) return null;
  if (!devMode.enabled || !devMode.showAIDebugPanel) return null;

  return <AIDebugPanelInner />;
}

function AIDebugPanelInner() {
  const devMode = useDevMode();
  const [activeTab, setActiveTab] = useState<
    "simulator" | "profile" | "perf" | "logs"
  >("simulator");

  return (
    <div className="fixed bottom-0 right-0 w-[480px] max-h-[70vh] bg-card border border-border/50 rounded-tl-xl shadow-lg z-[9999] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/30 bg-muted/40">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-teal-500" />
          <span className="text-sm font-semibold">AI Debug Panel</span>
        </div>
        <button
          onClick={() => devMode.setShowAIDebugPanel(false)}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex border-b border-border/30">
        {(
          [
            { key: "simulator", label: "Simulator", icon: Play },
            { key: "profile", label: "Profile", icon: FileSearch },
            { key: "perf", label: "Perf", icon: Gauge },
            { key: "logs", label: "Logs", icon: Terminal },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
              activeTab === key
                ? "text-teal-600 border-b-2 border-teal-500 bg-teal-50/30"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 text-xs">
        {activeTab === "simulator" && <SimulatorTab />}
        {activeTab === "profile" && <ProfileTab />}
        {activeTab === "perf" && <PerfTab />}
        {activeTab === "logs" && <LogsTab />}
      </div>
    </div>
  );
}

function SimulatorTab() {
  const [input, setInput] = useState(
    "Frank must fix the boiler before 15 March"
  );
  const [result, setResult] = useState<CreateTaskSimulationResult | null>(null);

  const run = useCallback(() => {
    const r = simulateCreateTask(input, {
      propertyProfile: normalizePropertyProfile({
        propertyId: "debug-property",
        siteType: "commercial",
        ownershipType: "leased",
        presentAssetTypes: ["Boiler", "Passenger Lifts"],
      }),
      entities: {
        members: [
          { id: "m1", user_id: "u1", display_name: "Frank Smith" },
          { id: "m2", user_id: "u2", display_name: "Sarah Jones" },
        ],
        spaces: [
          { id: "s1", name: "Kitchen", property_id: "debug-property" },
          { id: "s2", name: "Boiler Room", property_id: "debug-property" },
        ],
      },
    });
    setResult(r);
  }, [input]);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Task Description
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full rounded-md border border-border/50 bg-background p-2 text-xs resize-none h-16 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
        <button
          onClick={run}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-teal-600 text-white text-xs font-medium hover:bg-teal-700 transition-colors"
        >
          <Play className="h-3 w-3" />
          Run Simulation
        </button>
      </div>

      {result && (
        <div className="space-y-2">
          <CollapsibleSection title="Diagnostics" defaultOpen>
            <div className="grid grid-cols-2 gap-1">
              <MetricRow
                label="Extraction"
                value={`${result.diagnostics.extractionTimeMs}ms`}
              />
              <MetricRow
                label="Profile Boost"
                value={`${result.diagnostics.profileBoostTimeMs}ms`}
              />
              <MetricRow
                label="Total"
                value={`${result.diagnostics.totalTimeMs}ms`}
              />
              <MetricRow
                label="Chips"
                value={String(result.diagnostics.chipCount)}
              />
              <MetricRow
                label="Ghost Groups"
                value={String(result.diagnostics.ghostCategoryCount)}
              />
              <MetricRow
                label="Compliance Mode"
                value={result.diagnostics.complianceMode ? "Yes" : "No"}
              />
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            title={`Final Chips (${result.finalChips.length})`}
            defaultOpen
          >
            {result.finalChips.map((chip, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-1 border-b border-border/20 last:border-0"
              >
                <div>
                  <span className="font-mono text-teal-600">{chip.type}</span>
                  <span className="ml-1 text-muted-foreground">
                    {chip.label}
                  </span>
                </div>
                <span className="font-mono font-semibold">
                  {chip.score.toFixed(2)}
                </span>
              </div>
            ))}
            {result.finalChips.length === 0 && (
              <span className="text-muted-foreground">No chips detected</span>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title={`Profile Boosts (${result.profileBoosts.length})`}
          >
            {result.profileBoosts.map((b, i) => (
              <div key={i} className="py-1 border-b border-border/20 last:border-0">
                <div className="flex justify-between">
                  <span className="font-mono text-purple-600">
                    {b.chipType}
                  </span>
                  <span className="font-mono font-semibold">
                    +{b.score.toFixed(2)}
                  </span>
                </div>
                <div className="text-muted-foreground mt-0.5">
                  {b.rationale}
                </div>
              </div>
            ))}
          </CollapsibleSection>

          <CollapsibleSection title="Raw Extraction">
            <pre className="overflow-x-auto whitespace-pre-wrap text-[10px] font-mono bg-muted/30 rounded p-2">
              {JSON.stringify(result.ruleExtraction, null, 2)}
            </pre>
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}

function ProfileTab() {
  const [siteType, setSiteType] = useState<string>("commercial");
  const [ownership, setOwnership] = useState<string>("leased");
  const [result, setResult] = useState<ReturnType<
    typeof evaluateProfileDiagnostics
  > | null>(null);

  const evaluate = useCallback(() => {
    const profile = normalizePropertyProfile({
      propertyId: "debug-property",
      siteType: siteType as PropertyProfile["siteType"],
      ownershipType: ownership as PropertyProfile["ownershipType"],
      isListed: false,
      presentAssetTypes: ["Boiler", "HVAC Units", "Passenger Lifts"],
    });
    setResult(evaluateProfileDiagnostics(profile));
  }, [siteType, ownership]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select
          value={siteType}
          onChange={(e) => setSiteType(e.target.value)}
          className="flex-1 rounded-md border border-border/50 bg-background p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
        >
          {["residential", "commercial", "mixed_use", "industrial", "land"].map(
            (t) => (
              <option key={t} value={t}>
                {t}
              </option>
            )
          )}
        </select>
        <select
          value={ownership}
          onChange={(e) => setOwnership(e.target.value)}
          className="flex-1 rounded-md border border-border/50 bg-background p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
        >
          {["owned", "leased", "rented", "managed", "other"].map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          onClick={evaluate}
          className="px-3 py-1.5 rounded-md bg-teal-600 text-white text-xs font-medium hover:bg-teal-700 transition-colors"
        >
          Evaluate
        </button>
      </div>

      {result && (
        <div className="space-y-2">
          <div className="flex gap-3">
            <MetricBadge
              label="Compliance"
              value={result.summary.complianceCount}
              color="text-orange-600"
            />
            <MetricBadge
              label="Boosts"
              value={result.summary.chipBoostCount}
              color="text-purple-600"
            />
            <MetricBadge
              label="Warnings"
              value={result.summary.warningCount}
              color="text-red-600"
            />
            <MetricBadge
              label="Time"
              value={`${result.evaluationTimeMs}ms`}
              color="text-teal-600"
            />
          </div>

          <CollapsibleSection
            title={`Compliance Rules (${result.summary.complianceCount})`}
            defaultOpen
          >
            {result.result.complianceRecommendations.map((r, i) => (
              <div
                key={i}
                className="py-1.5 border-b border-border/20 last:border-0"
              >
                <div className="font-medium">
                  {r.output.kind === "suggest_compliance"
                    ? r.output.complianceType
                    : r.ruleId}
                </div>
                <div className="text-muted-foreground mt-0.5">
                  {r.rationale}
                </div>
              </div>
            ))}
          </CollapsibleSection>

          <CollapsibleSection title="Chip Boosts">
            {result.result.chipBoosts.map((r, i) => (
              <div
                key={i}
                className="py-1 border-b border-border/20 last:border-0"
              >
                <span className="font-mono text-purple-600">
                  {r.output.kind === "chip_boost"
                    ? r.output.chipType
                    : r.ruleId}
                </span>
                <span className="ml-2 text-muted-foreground">
                  {r.rationale}
                </span>
              </div>
            ))}
          </CollapsibleSection>

          <CollapsibleSection title="Warnings">
            {result.result.warnings.map((r, i) => (
              <div
                key={i}
                className="py-1 text-amber-600 border-b border-border/20 last:border-0"
              >
                {r.output.kind === "clarity_warning"
                  ? r.output.message
                  : r.ruleId}
              </div>
            ))}
            {result.result.warnings.length === 0 && (
              <span className="text-muted-foreground">No warnings</span>
            )}
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}

function PerfTab() {
  const [, forceUpdate] = useState(0);
  const metrics = getAggregatedMetrics();
  const entries = getPerfEntries();

  useEffect(() => {
    return subscribePerfEntries(() => forceUpdate((n) => n + 1));
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium">
          Performance Metrics ({entries.length} entries)
        </span>
        <button
          onClick={() => {
            clearPerfEntries();
            forceUpdate((n) => n + 1);
          }}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded hover:bg-muted transition-colors text-muted-foreground"
        >
          <Trash2 className="h-3 w-3" />
          Clear
        </button>
      </div>

      {Object.keys(metrics).length > 0 ? (
        <div className="space-y-1">
          {Object.entries(metrics).map(([label, m]) => (
            <div
              key={label}
              className="flex items-center justify-between py-1 border-b border-border/20"
            >
              <span className="font-mono">{label}</span>
              <div className="flex gap-3 text-muted-foreground">
                <span>avg: {m.avgMs}ms</span>
                <span>min: {m.minMs}ms</span>
                <span>max: {m.maxMs}ms</span>
                <span>n={m.count}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <span className="text-muted-foreground">
          No performance data recorded yet
        </span>
      )}

      {entries.length > 0 && (
        <CollapsibleSection title="Recent Entries">
          {entries
            .slice(-20)
            .reverse()
            .map((e, i) => (
              <div
                key={i}
                className="flex justify-between py-0.5 border-b border-border/10 font-mono"
              >
                <span>{e.label}</span>
                <span
                  className={cn(
                    e.durationMs > 100
                      ? "text-red-600"
                      : e.durationMs > 50
                        ? "text-amber-600"
                        : "text-green-600"
                  )}
                >
                  {e.durationMs}ms
                </span>
              </div>
            ))}
        </CollapsibleSection>
      )}
    </div>
  );
}

function LogsTab() {
  const devMode = useDevMode();

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <h4 className="font-medium">Dev Mode State</h4>
        <pre className="overflow-x-auto whitespace-pre-wrap text-[10px] font-mono bg-muted/30 rounded p-2">
          {JSON.stringify(
            {
              enabled: devMode.enabled,
              userRoleOverride: devMode.userRoleOverride,
              simulateSlowNetwork: devMode.simulateSlowNetwork,
              simulateTimeShiftDays: devMode.simulateTimeShiftDays,
              showAIDebugPanel: devMode.showAIDebugPanel,
              createTaskDiagnostics: devMode.createTaskDiagnostics,
            },
            null,
            2
          )}
        </pre>
      </div>

      <div className="space-y-2">
        <h4 className="font-medium">Toggles</h4>
        <ToggleRow
          label="CreateTask Diagnostics"
          checked={devMode.createTaskDiagnostics}
          onChange={devMode.setCreateTaskDiagnostics}
        />
        <ToggleRow
          label="Slow Network"
          checked={devMode.simulateSlowNetwork}
          onChange={devMode.setSimulateSlowNetwork}
        />
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border/30 rounded-md overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full px-2.5 py-1.5 text-xs font-medium bg-muted/20 hover:bg-muted/40 transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {title}
      </button>
      {open && <div className="px-2.5 py-2">{children}</div>}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  );
}

function MetricBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className={cn("text-base font-bold font-mono", color)}>
        {value}
      </span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between py-1 cursor-pointer">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-border"
      />
    </label>
  );
}

export default AIDebugPanel;
