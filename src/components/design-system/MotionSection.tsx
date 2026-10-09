import { useEffect, useState, type ReactNode } from "react";
import { FileText, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buildIntakeDocumentBriefing, intakeOutcomeLabel } from "@/lib/intakeDocumentBriefing";
import { decideIntake, type IntakeDecisionAction } from "@/lib/intake/intakeDecision";
import { buildKnowledgeConnectionNodes } from "@/lib/intake/knowledgeConnection";
import { noteResolution, type ResolutionOutcome } from "@/lib/motion/resolutions";
import { IntakeDecisionPanel } from "@/components/intake/IntakeReviewSheet";
import type { IntakeSourceArtifact } from "@/types/intake-item";
import {
  AlignBlock,
  KnowledgeThread,
  Lift,
  MotionSequence,
  ResolutionLedger,
  ResolutionLedgerProvider,
  ResolvableItem,
  ResolvableList,
  Settle,
  SettleValue,
  SheetStack,
  SignalMark,
  Unfold,
  useFillaReducedMotion,
} from "@/components/motion";

const PROPERTY = { propertyName: "Linden House", propertyAddress: "12 Linden Road" };

const GAS_TEXT =
  "Landlord Gas Safety Record for 12 Linden Road. Boiler: Worcester Bosch Greenstar 8000, serial GC-47-311. " +
  "All appliances passed inspection. Certificate valid until 14 March 2027.";
const EICR_TEXT =
  "Electrical Installation Condition Report for 12 Linden Road. Overall assessment: Unsatisfactory. " +
  "C2 observation recorded at the consumer unit; remedial work required.";

type ScenarioId = "read" | "risk" | "filename" | "reading";

const SCENARIOS: Array<{ id: ScenarioId; label: string }> = [
  { id: "read", label: "Read → recommend" },
  { id: "risk", label: "Read → risk" },
  { id: "filename", label: "File name → one question" },
  { id: "reading", label: "Still reading → read" },
];

function artifactFor(id: ScenarioId, readFinished: boolean): IntakeSourceArtifact {
  const base = { intakeItemId: `demo-${id}`, storagePath: null, mimeType: "application/pdf" };
  if (id === "risk") return { ...base, fileName: "eicr-flat-2.pdf", rawText: EICR_TEXT };
  if (id === "filename") return { ...base, fileName: "EICR_2026_flat3.pdf", rawText: null };
  if (id === "reading" && !readFinished) return { ...base, fileName: "scan_0042.pdf", rawText: null };
  return { ...base, fileName: "cp12-flat-2.pdf", rawText: GAS_TEXT };
}

function DemoFrame({ title, caption, onReplay, children }: {
  title: string;
  caption: string;
  onReplay?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-2xl bg-card p-4 shadow-e1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-mono text-2xs uppercase text-muted-foreground">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
        </div>
        {onReplay ? (
          <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 gap-1.5" onClick={onReplay}>
            <RotateCcw className="h-3.5 w-3.5" /> Replay
          </Button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function GrammarTile({ verb, meaning, children }: { verb: string; meaning: string; children: ReactNode }) {
  const [run, setRun] = useState(0);
  return (
    <button
      type="button"
      onClick={() => setRun((n) => n + 1)}
      className="flex min-h-36 flex-col justify-between rounded-xl bg-background/60 p-3 text-left shadow-e1"
    >
      <div key={run} className="flex flex-1 items-center justify-center py-3">
        {children}
      </div>
      <div>
        <p className="font-mono text-2xs uppercase text-foreground">{verb}</p>
        <p className="text-caption text-muted-foreground">{meaning}</p>
      </div>
    </button>
  );
}

function PaperChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("relative inline-flex rounded-sharp bg-card px-2.5 py-1 text-caption font-medium text-foreground shadow-e1", className)}>
      {children}
    </span>
  );
}

function GrammarStrip() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <GrammarTile verb="Lift" meaning="Active or relevant">
        <Lift step={0} radiusClassName="rounded-sharp">
          <PaperChip>What is this?</PaperChip>
        </Lift>
      </GrammarTile>
      <GrammarTile verb="Align" meaning="Connected">
        <AlignBlock step={0} className="max-w-[9rem]">
          <p className="text-caption text-foreground">Matches the boiler on file</p>
        </AlignBlock>
      </GrammarTile>
      <GrammarTile verb="Stack" meaning="Knowledge accumulating">
        <StackDemo />
      </GrammarTile>
      <GrammarTile verb="Unfold" meaning="Understanding revealed">
        <div className="space-y-1">
          {["Type · EICR", "Outcome · C2", "Expiry · 2031"].map((fact, index) => (
            <Unfold key={fact} step={0} index={index}>
              <PaperChip>{fact}</PaperChip>
            </Unfold>
          ))}
        </div>
      </GrammarTile>
      <GrammarTile verb="Settle" meaning="Decision reached">
        <Settle step={0} radiusClassName="rounded-sharp">
          <PaperChip className="bg-primary">Keep on file</PaperChip>
        </Settle>
      </GrammarTile>
      <GrammarTile verb="Signal" meaning="Needs attention">
        <PaperChip className="pr-3">
          Unsatisfactory
          <SignalMark tone="risk" edge="bottom" persist />
        </PaperChip>
      </GrammarTile>
    </div>
  );
}

function StackDemo() {
  const [arrivals, setArrivals] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => setArrivals(1), 250);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-2xs uppercase text-muted-foreground">
      <SheetStack arrivals={arrivals} className="scale-150" />
      <span className="ml-1">On file</span>
      <SettleValue value={String(3 + arrivals)} className="tabular-nums text-foreground" />
    </span>
  );
}

function IntakeUnderstandingDemo() {
  const [scenario, setScenario] = useState<ScenarioId>("read");
  const [run, setRun] = useState(0);
  const [readFinished, setReadFinished] = useState(false);
  const [confirmed, setConfirmed] = useState<IntakeDecisionAction | null>(null);
  const [lastRun, setLastRun] = useState<string | null>(null);

  useEffect(() => {
    setReadFinished(false);
    setConfirmed(null);
    setLastRun(null);
    if (scenario !== "reading") return;
    const timer = window.setTimeout(() => setReadFinished(true), 1600);
    return () => window.clearTimeout(timer);
  }, [scenario, run]);

  const artifact = artifactFor(scenario, readFinished);
  const briefing = buildIntakeDocumentBriefing(artifact, null, PROPERTY);
  const stillReading = scenario === "reading" && !readFinished;
  const decision = decideIntake({ briefing, mimeType: artifact.mimeType, scanStillRunning: stillReading });
  const typeValue = briefing.typeEvidence === "document" ? briefing.documentType || "Not identified" : "Not confirmed";
  const outcomeValue =
    briefing.typeEvidence === "document"
      ? briefing.understanding.statusLabel || intakeOutcomeLabel(briefing.outcome)
      : "Not stated";
  const expiryValue = briefing.expiryDate
    ? new Date(`${briefing.expiryDate}T00:00:00`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Not found";

  return (
    <DemoFrame
      title="Reference 1 · Intake understanding"
      caption="Input → extracted facts → interpretation → one recommendation or one question → settled. Uses the real decideIntake and IntakeDecisionPanel; nothing runs until a button is pressed."
      onReplay={() => setRun((n) => n + 1)}
    >
      <div className="flex flex-wrap gap-1.5">
        {SCENARIOS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setScenario(item.id);
              setRun((n) => n + 1);
            }}
            className={cn(
              "rounded-full px-2.5 py-1 font-mono text-2xs uppercase",
              scenario === item.id ? "bg-primary text-primary-foreground shadow-e1" : "bg-muted/50 text-muted-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mx-auto max-w-md rounded-xl bg-background p-4 shadow-e2">
        <MotionSequence key={`${scenario}-${run}`} id={`demo-intake-${scenario}-${run}`}>
          <div className="space-y-4">
            <Unfold step={0} className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-card bg-muted/40 shadow-e1">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </span>
              <div className="min-w-0">
                <p className="text-base font-semibold leading-snug text-foreground">{briefing.title}</p>
                <p className="truncate text-xs text-muted-foreground">{artifact.fileName}</p>
              </div>
            </Unfold>

            <dl className="divide-y divide-border/40">
              {(
                [
                  ["Type", typeValue, false],
                  ["Outcome", outcomeValue, briefing.needsFollowUp],
                  ["Expiry", expiryValue, false],
                ] as const
              ).map(([label, value, risk], index) => (
                <Unfold key={label} step={1} index={index} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 py-2">
                  <dt className="pt-0.5 text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-sm font-medium text-foreground">
                    <span className="relative inline-block">
                      <SettleValue value={value} />
                      {risk ? <SignalMark tone="risk" edge="bottom" persist step={1} index={index} /> : null}
                    </span>
                  </dd>
                </Unfold>
              ))}
            </dl>

            {briefing.summary ? (
              <AlignBlock key={briefing.summary} step={2}>
                <p className="text-sm leading-relaxed text-foreground">{briefing.summary}</p>
              </AlignBlock>
            ) : null}

            <IntakeDecisionPanel
              decision={decision}
              confirmedAction={confirmed}
              showOtherActions={false}
              filingKnowledge={false}
              allowKnowledge={false}
              onConfirm={(action) => setConfirmed(action === "something_else" ? null : action)}
              onRun={(action) => setLastRun(action)}
              onToggleOther={() => undefined}
            />
            {lastRun ? (
              <p className="text-caption text-muted-foreground">
                Pressed “{lastRun}”. In the app this opens the confirmation step; the demo stops here.
              </p>
            ) : null}
          </div>
        </MotionSequence>
      </div>
    </DemoFrame>
  );
}

type DemoRow = { id: string; title: string; insight: string };

const DEMO_ROWS: DemoRow[] = [
  { id: "r1", title: "Gas safety certificate", insight: "Valid until 14 Mar 2027" },
  { id: "r2", title: "Leak under kitchen sink", insight: "Photo · reads as a repair" },
  { id: "r3", title: "Newsletter.pdf", insight: "Nothing property-specific" },
];

function InflowResolutionDemo() {
  const [rows, setRows] = useState(DEMO_ROWS);
  const resolve = (id: string, outcome: ResolutionOutcome) => {
    noteResolution("intake", id, outcome);
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  return (
    <DemoFrame
      title="Reference 2 · Inflow resolution"
      caption="Kept items condense into the destination they joined; dismissed items recede with no destination. Runs only after the write succeeds."
      onReplay={() => setRows(DEMO_ROWS)}
    >
      <ResolutionLedgerProvider>
        <div className="mx-auto max-w-md space-y-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xs uppercase text-muted-foreground">Uploads to review</span>
            <ResolutionLedger className="ml-auto" />
          </div>
          <div className="space-y-2">
            <ResolvableList>
              {rows.map((row) => (
                <ResolvableItem key={row.id} id={row.id} scope="intake">
                  <div className="flex items-center gap-3 rounded-[10px] bg-card/80 px-3 py-2.5 shadow-e1">
                    <span data-resolve-content className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-muted/40 shadow-e1">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <div data-resolve-content className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{row.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{row.insight}</p>
                    </div>
                    <div data-resolve-content className="flex shrink-0 items-center gap-1">
                      <Button size="sm" className="h-8 px-2.5" onClick={() => resolve(row.id, "filed")}>File</Button>
                      <Button size="sm" variant="ghost" className="h-8 px-2.5" onClick={() => resolve(row.id, "task")}>Task</Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" aria-label="Dismiss" onClick={() => resolve(row.id, "dismissed")}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </ResolvableItem>
              ))}
            </ResolvableList>
          </div>
        </div>
      </ResolutionLedgerProvider>
    </DemoFrame>
  );
}

function KnowledgeConnectionDemo() {
  const [run, setRun] = useState(0);
  const nodes = buildKnowledgeConnectionNodes({
    documentLabel: "Boiler service report",
    asset: { assetId: "boiler", name: "Boiler", serial_number: "GC-47-311", matchedBy: "serial" },
    spaceName: "Utility room",
    renewal: { label: "Next due", date: "14 Mar 2027" },
  });
  return (
    <DemoFrame
      title="Reference 3 · Knowledge connection"
      caption="Document → recognised identifier → the asset already on the property → what saving keeps. The final link is dashed and marked On save until the user confirms."
      onReplay={() => setRun((n) => n + 1)}
    >
      <div className="mx-auto max-w-md rounded-xl bg-background p-4 shadow-e2">
        <KnowledgeThread key={run} sequenceId={`demo-${run}`} nodes={nodes} />
      </div>
    </DemoFrame>
  );
}

export function MotionSection() {
  const reduced = useFillaReducedMotion();
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink heading-l">Motion</h2>
        <p className="text-sm text-muted-foreground">
          Six verbs, one material: layered paper. Motion explains what Filla did — it never decorates and never
          delays an action. Spec: <code className="font-mono text-xs">@Docs/33_Motion_System.md</code>.
          {reduced ? " Reduced motion is on: everything below renders settled." : ""}
        </p>
      </div>
      <GrammarStrip />
      <div className="grid gap-4 lg:grid-cols-2">
        <IntakeUnderstandingDemo />
        <div className="space-y-4">
          <InflowResolutionDemo />
          <KnowledgeConnectionDemo />
        </div>
      </div>
    </section>
  );
}
