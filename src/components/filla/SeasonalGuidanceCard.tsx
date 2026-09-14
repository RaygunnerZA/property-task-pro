import { useNavigate } from "react-router-dom";
import { BookOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROPERTY_ASSETS_PATH } from "@/lib/mainNavigation";
import type { IntakeMode } from "@/types/intake";
import type { SeasonalCtaType, SeasonalPackage } from "@/types/seasonalPackage";
import {
  useDismissSeasonalPackage,
  useMarkSeasonalPackageCta,
} from "@/hooks/useActiveSeasonalPackages";

export type SeasonalGuidanceCardProps = {
  package: SeasonalPackage;
  onOpenIntake?: (mode: IntakeMode) => void;
  className?: string;
  /** Compact rail layout for left column. */
  variant?: "feed" | "rail";
};

function runCtaNavigation(
  ctaType: SeasonalCtaType,
  knowledgeId: string,
  navigate: ReturnType<typeof useNavigate>,
  onOpenIntake?: (mode: IntakeMode) => void
) {
  switch (ctaType) {
    case "create_task":
      onOpenIntake?.("report_issue");
      return;
    case "upload_document":
      onOpenIntake?.("add_record");
      return;
    case "add_asset":
      navigate(PROPERTY_ASSETS_PATH);
      return;
    case "open_knowledge":
      navigate(`/knowledge?highlight=${encodeURIComponent(knowledgeId)}`);
      return;
    case "none":
    default:
      return;
  }
}

/**
 * Minimal seasonal editorial card — curated Knowledge, not operational Filla suggests.
 */
export function SeasonalGuidanceCard({
  package: pkg,
  onOpenIntake,
  className,
  variant = "feed",
}: SeasonalGuidanceCardProps) {
  const navigate = useNavigate();
  const dismiss = useDismissSeasonalPackage();
  const markCta = useMarkSeasonalPackageCta();
  const rail = variant === "rail";

  const handleDismiss = () => {
    dismiss.mutate(pkg.id);
  };

  const handleCta = (itemId: string, knowledgeId: string, ctaType: SeasonalCtaType) => {
    markCta.mutate({ packageId: pkg.id, itemId, knowledgeId });
    runCtaNavigation(ctaType, knowledgeId, navigate, onOpenIntake);
  };

  return (
    <section
      className={cn(
        "min-w-0 rounded-2xl bg-card/70 shadow-e1",
        rail ? "px-3 py-3" : "px-3.5 py-3.5",
        className
      )}
      aria-label="Seasonal guidance"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-start gap-2">
          <span
            className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-muted/50 text-muted-foreground"
            aria-hidden
          >
            <BookOpen className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              Seasonal guidance
              {pkg.prep_window_label ? ` · ${pkg.prep_window_label}` : null}
            </p>
            <h3
              className={cn(
                "mt-0.5 font-medium leading-snug text-foreground",
                rail ? "text-sm" : "text-base"
              )}
            >
              {pkg.title}
            </h3>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss seasonal guidance"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          onClick={handleDismiss}
          disabled={dismiss.isPending}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <p
        className={cn(
          "mt-2 leading-relaxed text-muted-foreground",
          rail ? "text-xs" : "text-sm"
        )}
      >
        {pkg.introduction}
      </p>

      <ol className={cn("mt-3 space-y-2.5", rail ? "pl-0" : "pl-0")}>
        {pkg.items.map((item, index) => (
          <li key={item.id} className="min-w-0">
            <div className="flex gap-2">
              <span
                className="mt-0.5 w-4 shrink-0 text-right font-mono text-2xs text-muted-foreground/80"
                aria-hidden
              >
                {index + 1}.
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "leading-snug text-foreground/90",
                    rail ? "text-xs" : "text-sm"
                  )}
                >
                  {item.tip_text}
                </p>
                {item.cta_type !== "none" ? (
                  <button
                    type="button"
                    className={cn(
                      "mt-1 inline-flex items-center gap-0.5 font-medium text-primary hover:underline",
                      rail ? "text-xs" : "text-sm"
                    )}
                    onClick={() => handleCta(item.id, item.knowledge_id, item.cta_type)}
                    disabled={markCta.isPending}
                  >
                    {item.cta_label}
                    <span aria-hidden>→</span>
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <button
        type="button"
        className="mt-3 text-caption font-medium text-muted-foreground hover:text-foreground hover:underline"
        onClick={() => navigate("/knowledge")}
      >
        Browse Knowledge library
      </button>
    </section>
  );
}
