/**
 * Pure catalogue scan planner — Watch-run applies the upserts.
 * Does not create Knowledge. News is potential_change only.
 */

import {
  canonicalCataloguePath,
  cataloguePageUrl,
  classifyCatalogueHit,
  detectionFromHitClass,
  queueLaneForCatalogueDetection,
  shouldCreateKnowledgeFromDetection,
  shouldFetchCataloguePageBody,
  type CatalogueDetection,
  type CataloguePageStatus,
  type CatalogueSearchHit,
  type OfficialCatalogueSection,
} from "./officialSourceCatalogue.ts";

export type TrackedPageSnapshot = {
  canonical_path: string;
  content_id?: string | null;
  public_updated_at?: string | null;
  section_hash?: string | null;
  status: CataloguePageStatus;
  detection: CatalogueDetection;
  knowledge_ids: string[];
};

export type CataloguePageUpsert = {
  canonical_path: string;
  source_url: string;
  content_id?: string | null;
  public_updated_at?: string | null;
  document_type?: string | null;
  title?: string | null;
  status: CataloguePageStatus;
  detection: CatalogueDetection;
  knowledge_ids: string[];
  fetch_body: boolean;
  queue_lane: "monitoring" | "attention";
};

export function planCataloguePageUpserts(input: {
  section: OfficialCatalogueSection;
  existing: TrackedPageSnapshot[];
  hits: CatalogueSearchHit[];
  knowledgeIdsByPath?: Record<string, string[]>;
}): { upserts: CataloguePageUpsert[]; withdrawnPaths: string[] } {
  const existingByPath = new Map(
    input.existing.map((p) => [canonicalCataloguePath(p.canonical_path), p])
  );
  const seen = new Set<string>();
  const upserts: CataloguePageUpsert[] = [];

  for (const seed of input.section.locator.seed_paths ?? []) {
    const path = canonicalCataloguePath(seed);
    if (!path || seen.has(path)) continue;
    seen.add(path);
    const prev = existingByPath.get(path);
    const knowledgeIds = input.knowledgeIdsByPath?.[path] ?? prev?.knowledge_ids ?? [];
    upserts.push({
      canonical_path: path,
      source_url: cataloguePageUrl(input.section, seed),
      content_id: prev?.content_id ?? null,
      public_updated_at: prev?.public_updated_at ?? null,
      document_type: null,
      title: null,
      status: prev?.status === "withdrawn" ? "tracked" : prev?.status ?? "tracked",
      detection: prev?.detection ?? "none",
      knowledge_ids: knowledgeIds,
      fetch_body: false,
      queue_lane: "monitoring",
    });
  }

  for (const hit of input.hits) {
    const klass = classifyCatalogueHit(hit);
    if (klass === "excluded") continue;
    const path = canonicalCataloguePath(hit.link);
    if (!path || seen.has(path)) continue;
    seen.add(path);
    const prev = existingByPath.get(path);
    const alreadyTracked = Boolean(prev);
    const detection = detectionFromHitClass(klass, alreadyTracked);
    const knowledgeIds = input.knowledgeIdsByPath?.[path] ?? prev?.knowledge_ids ?? [];
    const status: CataloguePageStatus =
      detection === "potential_change"
        ? "assessing"
        : detection === "new_guidance"
          ? "assessing"
          : prev?.status ?? "tracked";
    upserts.push({
      canonical_path: path,
      source_url: cataloguePageUrl(input.section, hit.link),
      content_id: hit.content_id ?? prev?.content_id ?? null,
      public_updated_at: hit.public_timestamp ?? prev?.public_updated_at ?? null,
      document_type: hit.document_type ?? null,
      title: hit.title,
      status,
      detection: alreadyTracked && detection === "new_guidance" ? "none" : detection,
      knowledge_ids: knowledgeIds,
      fetch_body: shouldFetchCataloguePageBody({
        previous: prev ?? null,
        next: {
          content_id: hit.content_id ?? null,
          public_updated_at: hit.public_timestamp ?? null,
        },
      }),
      queue_lane: queueLaneForCatalogueDetection({
        kind: alreadyTracked && detection === "new_guidance" ? "none" : detection,
        affectedKnowledgeIds: knowledgeIds,
      }),
    });
  }

  const withdrawnPaths: string[] = [];
  for (const prev of input.existing) {
    const path = canonicalCataloguePath(prev.canonical_path);
    if (!seen.has(path) && prev.status !== "ignored" && prev.status !== "withdrawn") {
      withdrawnPaths.push(path);
    }
  }

  return { upserts, withdrawnPaths };
}

export function planMetadataRefresh(input: {
  previous: TrackedPageSnapshot;
  nextContentId?: string | null;
  nextPublicUpdatedAt?: string | null;
  withdrawn?: boolean;
  knowledgeIds?: string[];
}): {
  detection: CatalogueDetection;
  status: CataloguePageStatus;
  fetch_body: boolean;
  queue_lane: "monitoring" | "attention";
} {
  const knowledgeIds = input.knowledgeIds ?? input.previous.knowledge_ids;
  if (input.withdrawn) {
    const detection: CatalogueDetection = "withdrawn";
    return {
      detection,
      status: "withdrawn",
      fetch_body: false,
      queue_lane: queueLaneForCatalogueDetection({
        kind: detection,
        affectedKnowledgeIds: knowledgeIds,
      }),
    };
  }
  const fetchBody = shouldFetchCataloguePageBody({
    previous: input.previous,
    next: {
      content_id: input.nextContentId ?? null,
      public_updated_at: input.nextPublicUpdatedAt ?? null,
    },
  });
  const detection: CatalogueDetection = fetchBody ? "guidance_changed" : "none";
  return {
    detection,
    status: input.previous.status === "assessing" ? "tracked" : input.previous.status,
    fetch_body: fetchBody,
    queue_lane: queueLaneForCatalogueDetection({
      kind: detection,
      affectedKnowledgeIds: knowledgeIds,
    }),
  };
}

export function catalogueDetectionsMustNotCreateKnowledge(
  detections: CatalogueDetection[]
): boolean {
  return detections.every((d) => !shouldCreateKnowledgeFromDetection(d));
}
