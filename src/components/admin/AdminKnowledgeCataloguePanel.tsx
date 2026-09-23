/**
 * Compact Official Source Catalogue — approve the shape once, then stay quiet.
 */
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useAcceptKnowledgeCatalogue,
  useKnowledgeCatalogue,
  useRunKnowledgeWatch,
  useSetKnowledgeCatalogueStatus,
} from "@/hooks/admin/useKnowledgeWatch";
import {
  ENGLAND_HOUSING_ORIENTATION_REVIEW,
  ENGLAND_RECOMMENDED_CATALOGUE_IDS,
  formatMaterialChangeCopy,
  formatPotentialChangeCopy,
  type CatalogueReviewReport,
} from "@/lib/content/officialSourceCatalogue";

function statusLabel(status: string): string {
  if (status === "accepted") return "Accepted";
  if (status === "paused") return "Paused";
  return "Proposed";
}

export function AdminKnowledgeCataloguePanel() {
  const catalogueQuery = useKnowledgeCatalogue();
  const acceptCatalogue = useAcceptKnowledgeCatalogue();
  const setStatus = useSetKnowledgeCatalogueStatus();
  const runWatch = useRunKnowledgeWatch();
  const [adjustOpen, setAdjustOpen] = useState(false);

  const sections = catalogueQuery.data?.sections ?? [];
  const review: CatalogueReviewReport =
    catalogueQuery.data?.review ?? ENGLAND_HOUSING_ORIENTATION_REVIEW;
  const detections = catalogueQuery.data?.detections ?? [];
  const acceptedCount = sections.filter((s) => s.status === "accepted").length;
  const monitoringDetections = detections.filter(
    (d) =>
      d.detection === "potential_change" ||
      d.detection === "new_guidance" ||
      (d.detection === "guidance_changed" && (d.knowledge_ids?.length ?? 0) === 0)
  );
  const attentionDetections = detections.filter(
    (d) =>
      (d.detection === "guidance_changed" || d.detection === "withdrawn") &&
      (d.knowledge_ids?.length ?? 0) > 0
  );

  const recommendedIds = useMemo(
    () =>
      review.recommended_section_ids?.length
        ? review.recommended_section_ids
        : ENGLAND_RECOMMENDED_CATALOGUE_IDS,
    [review.recommended_section_ids]
  );

  const acceptRecommended = () =>
    void acceptCatalogue.mutateAsync({
      ids: recommendedIds,
      reason: "Accept recommended England official catalogue",
    });

  return (
    <div className="rounded-xl bg-muted/30 px-3 py-2.5 space-y-3">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Official source catalogue
        </p>
        <p className="text-sm text-foreground leading-snug mt-0.5">
          Approve the shape of official sections once. Filla watches those bounds — it does not
          import service-result pages.
        </p>
      </div>

      {catalogueQuery.isLoading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      ) : catalogueQuery.isError ? (
        <p className="text-xs text-destructive">
          {(catalogueQuery.error as Error)?.message ||
            "Couldn't load the catalogue. Confirm the latest migration is applied."}
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">{review.seed_label}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {review.total_found} service results found. {review.relevant_count} appear relevant
              to property management. {review.compliance_guidance_count} are likely compliance
              guidance. {review.excluded_count} transactional or resident-service pages excluded.
            </p>
            <p className="text-xs text-muted-foreground">Recommended watch areas:</p>
            <ul className="text-xs text-foreground space-y-0.5 pl-4 list-disc">
              {review.recommended_watch_areas.map((area) => (
                <li key={area}>{area}</li>
              ))}
            </ul>
            {review.adapter_error ? (
              <p className="text-xs text-destructive">
                Search adapter failed: {review.adapter_error}. Orientation counts kept.
              </p>
            ) : null}
            <p className="text-[11px] text-muted-foreground">{review.note}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="shadow-primary-btn border-0 h-8 text-xs"
              disabled={acceptCatalogue.isPending || acceptedCount === recommendedIds.length}
              onClick={acceptRecommended}
            >
              {acceptCatalogue.isPending ? "Accepting…" : "Accept recommended catalogue"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-0 btn-neomorphic h-8 text-xs"
              onClick={() => setAdjustOpen((v) => !v)}
            >
              Adjust
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-0 btn-neomorphic h-8 text-xs"
              disabled={runWatch.isPending}
              onClick={() =>
                void runWatch.mutateAsync({ trigger: "manual", phase: "catalogue_review" })
              }
            >
              {runWatch.isPending ? "Reviewing…" : "Review housing seed"}
            </Button>
          </div>

          <ul className="space-y-1">
            {sections.map((section) => (
              <li
                key={section.id}
                className="flex items-start justify-between gap-2 text-xs"
              >
                <div>
                  <p className="text-foreground">
                    {section.title}
                    <span className="ml-1.5 text-muted-foreground">
                      {statusLabel(section.status)}
                      {section.tracked_page_count > 0
                        ? ` · ${section.tracked_page_count} tracked`
                        : ""}
                    </span>
                  </p>
                  {section.last_scan_at ? (
                    <p className="text-muted-foreground">
                      Last scan {new Date(section.last_scan_at).toLocaleString()}
                      {section.last_scan_ok === false && section.last_scan_error
                        ? ` · ${section.last_scan_error}`
                        : ""}
                    </p>
                  ) : null}
                </div>
                {adjustOpen ? (
                  <button
                    type="button"
                    className="text-primary hover:underline shrink-0"
                    disabled={setStatus.isPending}
                    onClick={() =>
                      void setStatus.mutateAsync({
                        id: section.id,
                        status: section.status === "accepted" ? "paused" : "accepted",
                        reason: "Adjust official catalogue section",
                      })
                    }
                  >
                    {section.status === "accepted" ? "Pause" : "Accept"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>

          {attentionDetections.length > 0 ? (
            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Needs a decision
              </p>
              {attentionDetections.slice(0, 4).map((d) => (
                <p key={d.id} className="text-xs text-foreground leading-snug">
                  {formatMaterialChangeCopy({
                    affectedClaimCount: d.knowledge_ids?.length ?? 0,
                  })}
                </p>
              ))}
            </div>
          ) : null}

          {monitoringDetections.length > 0 ? (
            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Monitoring
              </p>
              {monitoringDetections.slice(0, 5).map((d) => {
                if (d.detection === "potential_change") {
                  const copy = formatPotentialChangeCopy({
                    title: d.title || d.canonical_path,
                  });
                  return (
                    <p key={d.id} className="text-xs text-muted-foreground leading-snug">
                      {copy.headline}. {copy.body}
                    </p>
                  );
                }
                return (
                  <p key={d.id} className="text-xs text-muted-foreground leading-snug">
                    New official page being assessed: {d.title || d.canonical_path}
                  </p>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              {acceptedCount > 0
                ? "Accepted sections stay in Monitoring until a consequential change appears."
                : "Nothing is watched until you accept the catalogue."}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function CatalogueMonitoringStrip({ className }: { className?: string }) {
  const catalogueQuery = useKnowledgeCatalogue();
  const detections = (catalogueQuery.data?.detections ?? []).filter(
    (d) => d.detection === "potential_change" || d.detection === "new_guidance"
  );
  if (detections.length === 0) return null;

  return (
    <div className={cn("rounded-xl bg-card/80 shadow-e1 px-4 py-3 space-y-1.5", className)}>
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        Catalogue monitoring
      </p>
      {detections.slice(0, 4).map((d) =>
        d.detection === "potential_change" ? (
          <p key={d.id} className="text-sm text-foreground leading-snug">
            {formatPotentialChangeCopy({ title: d.title || d.canonical_path }).headline}. Current
            guidance remains valid.
          </p>
        ) : (
          <p key={d.id} className="text-sm text-muted-foreground leading-snug">
            New official guidance is being assessed — not a review item yet.
          </p>
        )
      )}
    </div>
  );
}
