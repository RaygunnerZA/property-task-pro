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
  SCOTLAND_BUILDING_STANDARDS_PROPOSAL,
  formatMaterialChangeCopy,
  formatPotentialChangeCopy,
  type CatalogueProposal,
  type CatalogueReviewReport,
} from "@/lib/content/officialSourceCatalogue";

type CatalogueSectionRow = {
  id: string;
  title: string;
  jurisdiction: string;
  status: string;
  tracked_page_count: number;
  last_scan_at: string | null;
  last_scan_ok: boolean | null;
  last_scan_error: string | null;
};

function statusLabel(status: string): string {
  if (status === "accepted") return "Accepted";
  if (status === "paused") return "Paused";
  return "Proposed";
}

function ProposalCard({
  proposal,
  sections,
  adjustOpen,
  accepting,
  onAccept,
  onToggleStatus,
}: {
  proposal: CatalogueProposal;
  sections: CatalogueSectionRow[];
  adjustOpen: boolean;
  accepting: boolean;
  onAccept: () => void;
  onToggleStatus: (section: CatalogueSectionRow) => void;
}) {
  const scoped = sections.filter((s) => proposal.recommended_section_ids.includes(s.id));
  const acceptedCount = scoped.filter((s) => s.status === "accepted").length;
  const allAccepted =
    scoped.length > 0 && acceptedCount === proposal.recommended_section_ids.length;

  return (
    <div className="rounded-lg bg-background/60 px-3 py-2.5 space-y-2">
      <div>
        <p className="text-sm font-medium text-foreground">{proposal.title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
          {proposal.summary}
        </p>
        {proposal.collection_url ? (
          <a
            href={proposal.collection_url}
            target="_blank"
            rel="noreferrer"
            className="text-[11px] text-primary hover:underline"
          >
            Official collection
          </a>
        ) : null}
      </div>

      <div>
        <p className="text-xs text-muted-foreground">Recommended active watches</p>
        <ul className="text-xs text-foreground space-y-0.5 pl-4 list-disc mt-0.5">
          {proposal.recommended_watch_areas.map((area) => (
            <li key={area}>{area}</li>
          ))}
        </ul>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {proposal.potential_change_note} {proposal.index_note}
      </p>
      {proposal.applicability_rule ? (
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Applicability: {proposal.applicability_rule}
        </p>
      ) : null}
      {proposal.priority_change_notice ? (
        <p className="text-[11px] text-foreground/80 leading-relaxed">
          Current priority: {proposal.priority_change_notice}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="shadow-primary-btn border-0 h-8 text-xs"
          disabled={accepting || allAccepted || scoped.length === 0}
          onClick={onAccept}
        >
          {accepting ? "Accepting…" : allAccepted ? "Catalogue accepted" : "Accept catalogue"}
        </Button>
      </div>

      {scoped.length > 0 ? (
        <ul className="space-y-1">
          {scoped.map((section) => (
            <li key={section.id} className="flex items-start justify-between gap-2 text-xs">
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
                  onClick={() => onToggleStatus(section)}
                >
                  {section.status === "accepted" ? "Pause" : "Accept"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function AdminKnowledgeCataloguePanel() {
  const catalogueQuery = useKnowledgeCatalogue();
  const acceptCatalogue = useAcceptKnowledgeCatalogue();
  const setStatus = useSetKnowledgeCatalogueStatus();
  const runWatch = useRunKnowledgeWatch();
  const [adjustOpen, setAdjustOpen] = useState(false);

  const sections = (catalogueQuery.data?.sections ?? []) as CatalogueSectionRow[];
  const review: CatalogueReviewReport =
    catalogueQuery.data?.review ?? ENGLAND_HOUSING_ORIENTATION_REVIEW;
  const detections = catalogueQuery.data?.detections ?? [];
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

  const englandIds = useMemo(
    () =>
      review.recommended_section_ids?.length
        ? review.recommended_section_ids
        : ENGLAND_RECOMMENDED_CATALOGUE_IDS,
    [review.recommended_section_ids]
  );

  const englandProposal: CatalogueProposal = useMemo(
    () => ({
      id: "england-housing",
      jurisdiction: "England",
      title: review.seed_label,
      summary: `${review.total_found} service results found. ${review.relevant_count} appear relevant to property management. ${review.compliance_guidance_count} are likely compliance guidance. Accepting watches bounded official sections — it does not import the service-result page.`,
      recommended_section_ids: englandIds,
      recommended_watch_areas: review.recommended_watch_areas,
      index_note: review.note,
      potential_change_note: "News and consultations are Potential changes only.",
      source: "orientation",
    }),
    [englandIds, review]
  );

  const englandSections = sections.filter((s) => s.jurisdiction === "England");
  const scotlandSections = sections.filter((s) => s.id === "scotland-building-standards");
  const showEnglandProposal = englandSections.some((s) => s.status !== "accepted");

  return (
    <div className="rounded-xl bg-muted/30 px-3 py-2.5 space-y-3">
      <div>
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Official source catalogue
        </p>
        <p className="text-sm text-foreground leading-snug mt-0.5">
          Approve the shape of official sections once. Filla watches those bounds — it does not
          import whole collections or service-result pages.
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
          <ProposalCard
            proposal={SCOTLAND_BUILDING_STANDARDS_PROPOSAL}
            sections={scotlandSections}
            adjustOpen={adjustOpen}
            accepting={acceptCatalogue.isPending}
            onAccept={() =>
              void acceptCatalogue.mutateAsync({
                ids: [...SCOTLAND_BUILDING_STANDARDS_PROPOSAL.recommended_section_ids],
                reason: "Accept Scottish Building Standards catalogue",
              })
            }
            onToggleStatus={(section) =>
              void setStatus.mutateAsync({
                id: section.id,
                status: section.status === "accepted" ? "paused" : "accepted",
                reason: "Adjust official catalogue section",
              })
            }
          />
          {scotlandSections.length === 0 ? (
            <p className="text-[11px] text-muted-foreground -mt-1">
              Apply the Scotland Building Standards catalogue migration to enable Accept.
            </p>
          ) : null}

          {showEnglandProposal ? (
            <ProposalCard
              proposal={englandProposal}
              sections={englandSections}
              adjustOpen={adjustOpen}
              accepting={acceptCatalogue.isPending}
              onAccept={() =>
                void acceptCatalogue.mutateAsync({
                  ids: englandIds,
                  reason: "Accept recommended England official catalogue",
                })
              }
              onToggleStatus={(section) =>
                void setStatus.mutateAsync({
                  id: section.id,
                  status: section.status === "accepted" ? "paused" : "accepted",
                  reason: "Adjust official catalogue section",
                })
              }
            />
          ) : englandSections.length > 0 ? (
            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                England (accepted)
              </p>
              <ul className="space-y-0.5">
                {englandSections.map((section) => (
                  <li key={section.id} className="text-xs text-muted-foreground">
                    {section.title}
                    {section.tracked_page_count > 0
                      ? ` · ${section.tracked_page_count} tracked`
                      : ""}
                    {section.last_scan_ok === false && section.last_scan_error
                      ? ` · ${section.last_scan_error}`
                      : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
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
              {monitoringDetections.slice(0, 4).map((d) => (
                <p
                  key={d.id}
                  className={cn(
                    "text-xs leading-snug",
                    d.detection === "potential_change"
                      ? "text-muted-foreground"
                      : "text-foreground"
                  )}
                >
                  {d.detection === "potential_change"
                    ? formatPotentialChangeCopy({ title: d.title || d.canonical_path }).headline
                    : d.title || d.canonical_path}
                </p>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function CatalogueMonitoringStrip() {
  const catalogueQuery = useKnowledgeCatalogue();
  const detections = catalogueQuery.data?.detections ?? [];
  const monitoring = detections.filter(
    (d) =>
      d.detection === "potential_change" ||
      d.detection === "new_guidance" ||
      (d.detection === "guidance_changed" && (d.knowledge_ids?.length ?? 0) === 0)
  );
  if (monitoring.length === 0) return null;
  return (
    <div className="rounded-xl bg-muted/25 px-3 py-2 space-y-1">
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        Catalogue monitoring
      </p>
      {monitoring.slice(0, 3).map((d) => (
        <p key={d.id} className="text-xs text-muted-foreground leading-snug">
          {d.detection === "potential_change"
            ? formatPotentialChangeCopy({ title: d.title || d.canonical_path }).headline
            : d.title || d.canonical_path}
        </p>
      ))}
    </div>
  );
}
