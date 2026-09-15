import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AdminContentTreePanel } from "@/components/admin/AdminContentTreePanel";
import { AdminContentPlanWorkspace } from "@/components/admin/AdminContentPlanWorkspace";
import { AdminSeasonalPackagesPanel } from "@/components/admin/AdminSeasonalPackagesPanel";

type OutputsView = "topics" | "packages";

/**
 * Advanced escape hatch: Content topics (legacy progressive plan) + Seasonal packages.
 * Routine path is Knowledge Schedule → Review package → Approve distribution.
 */
export function AdminOutputsPanel() {
  const [view, setView] = useState<OutputsView>("topics");
  const [legacyTree, setLegacyTree] = useState(false);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Advanced machinery for debugging stage trees and seasonal packages. Prefer the main{" "}
        <span className="font-medium text-foreground">Knowledge</span> queue for routine work.
      </p>
      <div className="flex flex-wrap gap-2 items-center">
        <Button
          size="sm"
          variant={view === "topics" ? "default" : "outline"}
          className={cn(
            "border-0",
            view === "topics" ? "shadow-primary-btn" : "btn-neomorphic"
          )}
          aria-pressed={view === "topics"}
          onClick={() => setView("topics")}
        >
          Content topics
        </Button>
        <Button
          size="sm"
          variant={view === "packages" ? "default" : "outline"}
          className={cn(
            "border-0",
            view === "packages" ? "shadow-primary-btn" : "btn-neomorphic"
          )}
          aria-pressed={view === "packages"}
          onClick={() => setView("packages")}
        >
          Seasonal packages
        </Button>
        {view === "topics" && (
          <button
            type="button"
            className="ml-auto text-[10px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground"
            onClick={() => setLegacyTree((v) => !v)}
          >
            {legacyTree ? "Use simple stages" : "Legacy stage tree"}
          </button>
        )}
      </div>
      {view === "topics" ? (
        legacyTree ? (
          <AdminContentTreePanel />
        ) : (
          <AdminContentPlanWorkspace />
        )
      ) : (
        <AdminSeasonalPackagesPanel />
      )}
    </div>
  );
}
