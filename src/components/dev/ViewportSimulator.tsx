/**
 * Dev-only responsive preview: iframe uses the chosen width/height so Tailwind
 * viewport breakpoints (sm/md/lg/…) match a real device.
 */

import { useCallback, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useDevMode } from "@/context/useDevMode";
import { isDevBuild } from "@/context/DevModeContext";
import { useDevEmbedLayout, buildDevEmbedUrl } from "@/hooks/useDevEmbedLayout";
import { LAYOUT_BREAKPOINTS } from "@/lib/layoutBreakpoints";
import { cn } from "@/lib/utils";
import { MonitorSmartphone, X, RotateCcw } from "lucide-react";

const TAILWIND_DEFAULT_MIN = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

const PRESETS = [
  { id: "se", label: "iPhone SE", w: 375, h: 667 },
  { id: "15", label: "iPhone 15", w: 390, h: 844 },
  { id: "15pm", label: "iPhone 15 Pro Max", w: 430, h: 932 },
  { id: "pixel", label: "Pixel 7", w: 412, h: 915 },
  { id: "pane", label: `Narrow pane (${LAYOUT_BREAKPOINTS.maxPane})`, w: LAYOUT_BREAKPOINTS.maxPane, h: 844 },
  { id: "md", label: "Tailwind md", w: 768, h: 900 },
  { id: "workspace", label: `Workspace (${LAYOUT_BREAKPOINTS.workspace})`, w: LAYOUT_BREAKPOINTS.workspace, h: 900 },
  { id: "layout", label: `Layout (${LAYOUT_BREAKPOINTS.layout})`, w: LAYOUT_BREAKPOINTS.layout, h: 900 },
  { id: "ipad", label: "iPad Mini", w: 768, h: 1024 },
] as const;

function describeViewport(width: number): string[] {
  const tags: string[] = [];
  if (width <= LAYOUT_BREAKPOINTS.maxPane) tags.push("max-pane");
  (Object.entries(TAILWIND_DEFAULT_MIN) as [keyof typeof TAILWIND_DEFAULT_MIN, number][]).forEach(
    ([name, px]) => {
      if (width >= px) tags.push(`${name}+`);
    }
  );
  if (width >= LAYOUT_BREAKPOINTS.workspace) tags.push("workspace+");
  if (width >= LAYOUT_BREAKPOINTS.layout) tags.push("layout+");
  return tags;
}

export function ViewportSimulator() {
  const devMode = useDevMode();
  const devEmbed = useDevEmbedLayout();

  if (!isDevBuild || devEmbed) return null;
  if (!devMode.enabled || !devMode.showViewportSimulator) return null;

  return <ViewportSimulatorInner onClose={() => devMode.setShowViewportSimulator(false)} />;
}

function ViewportSimulatorInner({ onClose }: { onClose: () => void }) {
  const { pathname, search } = useLocation();
  const [presetId, setPresetId] = useState<(typeof PRESETS)[number]["id"]>("15");
  const [landscape, setLandscape] = useState(false);
  const [customW, setCustomW] = useState(390);
  const [customH, setCustomH] = useState(844);
  const [mode, setMode] = useState<"preset" | "custom">("preset");

  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[1];
  const baseW = mode === "preset" ? preset.w : customW;
  const baseH = mode === "preset" ? preset.h : customH;
  const frameW = landscape ? baseH : baseW;
  const frameH = landscape ? baseW : baseH;

  const iframeSrc = useMemo(
    () => buildDevEmbedUrl(`${pathname}${search}`),
    [pathname, search]
  );

  const tags = useMemo(() => describeViewport(frameW), [frameW]);

  const pickPreset = useCallback((id: (typeof PRESETS)[number]["id"]) => {
    setPresetId(id);
    setMode("preset");
  }, []);

  return (
    <div
      className={cn(
        "fixed inset-y-0 right-0 z-[9998] flex w-full max-w-[min(100vw,520px)] flex-col",
        "border-l border-border/40 bg-card/95 shadow-[0_0_40px_rgba(0,0,0,0.12)] backdrop-blur-md"
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/30 px-3 py-2.5 bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          <MonitorSmartphone className="h-4 w-4 shrink-0 text-teal-600" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">Viewport simulator</p>
            <p className="text-[10px] text-muted-foreground font-mono truncate">
              {frameW}×{frameH}px · {tags.join(" · ")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0"
          aria-label="Close viewport simulator"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-border/20">
        <button
          type="button"
          onClick={() => setLandscape((v) => !v)}
          className={cn(
            "text-[10px] px-2 py-1 rounded-md font-medium transition-colors",
            landscape ? "bg-teal-100 text-teal-800 shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-muted"
          )}
        >
          Landscape
        </button>
        <button
          type="button"
          onClick={() => setMode("custom")}
          className={cn(
            "text-[10px] px-2 py-1 rounded-md font-medium transition-colors",
            mode === "custom" ? "bg-teal-100 text-teal-800 shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-muted"
          )}
        >
          Custom
        </button>
      </div>

      <div className="flex flex-wrap gap-1 px-3 pb-2 max-h-[120px] overflow-y-auto">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => pickPreset(p.id)}
            className={cn(
              "text-[10px] px-2 py-1 rounded-md font-medium transition-colors",
              mode === "preset" && presetId === p.id
                ? "bg-teal-100 text-teal-800 shadow-sm"
                : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {mode === "custom" && (
        <div className="flex items-center gap-2 px-3 pb-2 text-[11px]">
          <label className="flex items-center gap-1 text-muted-foreground">
            W
            <input
              type="number"
              min={280}
              max={2400}
              value={customW}
              onChange={(e) => setCustomW(Number(e.target.value) || 320)}
              className="w-16 rounded-md border border-border/50 bg-background px-1.5 py-0.5 font-mono"
            />
          </label>
          <label className="flex items-center gap-1 text-muted-foreground">
            H
            <input
              type="number"
              min={400}
              max={1600}
              value={customH}
              onChange={(e) => setCustomH(Number(e.target.value) || 568)}
              className="w-16 rounded-md border border-border/50 bg-background px-1.5 py-0.5 font-mono"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              setCustomW(preset.w);
              setCustomH(preset.h);
            }}
            className="ml-auto p-1 rounded-md hover:bg-muted text-muted-foreground"
            title="Copy size from current preset"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto p-3 bg-muted/20 flex items-start justify-center">
        <div
          className="rounded-[2rem] p-2 shadow-[0_12px_40px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.6)] bg-gradient-to-b from-muted/80 to-muted/40"
          style={{ width: frameW + 16, minHeight: frameH + 16 }}
        >
          <iframe
            title="Responsive preview"
            src={iframeSrc}
            className="rounded-[1.35rem] bg-background shadow-inner border border-border/20 block"
            style={{ width: frameW, height: frameH }}
          />
        </div>
      </div>
    </div>
  );
}

export default ViewportSimulator;
