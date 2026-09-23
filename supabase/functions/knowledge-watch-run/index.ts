/**
 * knowledge-watch-run — platform Knowledge Watch pass.
 *
 * Enforces pause + monthly research allowance server-side.
 * Does NOT write operational `signals`. Does NOT publish Knowledge.
 *
 * Pass order (cheap → expensive):
 * 1. Inventory existing Knowledge / subject keys (free)
 * 2. Official Source Catalogue: metadata-first Coverage + News Watch (Search/Content adapters)
 * 3. Detect new subjects (discovery + seasonal / coverage gaps) → candidates (free)
 * 4. Deduplicate into subjects (free)
 * 5. Decide whether deep research is warranted (free)
 * 6. Spend Watch allowance: knowledge-gap-research (search) + knowledge-intake-url (pages)
 *    → new Review candidates from official sources (never auto-publish)
 *
 * Catalogue and news detections do not create Knowledge.
 * Never bill allowance for inventory or rule-based discovery.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  checkResearchAllowance,
  currentPeriodYm,
  shouldDeepResearch,
  type AutomatedResearchMode,
  type ResearchAllowance,
  type WatchUsage,
} from "../_shared/knowledgeWatchAllowance.ts";
import {
  probeOfficialSourceUrl,
  validateOfficialSourceUrl,
} from "../_shared/officialSourceAllowlist.ts";
import {
  hasReviewableKnowledgeBody,
  titleFromResearchContext,
} from "../_shared/knowledgeTitleQuality.ts";
import { corsHeaders, corsPreflightResponse } from "../_shared/cors.ts";
import {
  buildCatalogueReviewReport,
  ENGLAND_HOUSING_ORIENTATION_REVIEW,
  GOVUK_HOUSING_TAXON_ID,
  catalogueSectionById,
  extractRelevantSectionText,
  formatMaterialChangeCopy,
  hashRelevantSections,
  shouldFetchCataloguePageBody,
} from "../_shared/officialSourceCatalogue.ts";
import { fetchGovukContent, sampleGovukSearch } from "../_shared/govukAdapters.ts";
import { planCataloguePageUpserts, planMetadataRefresh } from "../_shared/catalogueWatchScan.ts";

/** Pilot subjects that need multi-jurisdiction coverage for international packages. */
const INTL_COVERAGE_PILOTS: Array<{ subjectKey: string; title: string }> = [
  { subjectKey: "chimney-flue-sweeping", title: "Chimney and flue sweeping" },
  { subjectKey: "smoke-carbon-monoxide-alarms", title: "Smoke and carbon monoxide alarms" },
  { subjectKey: "before-heating-season", title: "Before the heating season" },
  { subjectKey: "gutters-autumn-leaf-risk", title: "Gutters and autumn leaf risk" },
];

const PRIORITY_JURISDICTIONS = ["England", "Scotland", "France", "Switzerland"];

function jurisdictionsFromApplicability(app: Record<string, unknown> | null | undefined): string[] {
  if (!app || typeof app !== "object") return [];
  if (app.unscoped === true) return [];
  const raw = app.jurisdictions;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((j): j is string => typeof j === "string" && j.trim().length > 0)
    .map((j) => j.trim());
}

/** Pilot watch catalog — propose only when no matching platform Knowledge exists. */
const WATCH_DETECT_SUBJECTS: Array<{
  subjectKey: string;
  title: string;
  summary: string;
  body: string;
  /** UTC months (0–11) when seasonal; null = always (coverage gap). */
  months: number[] | null;
  changeKind: "seasonal" | "knowledge_gap";
  label: string;
}> = [
  {
    subjectKey: "before-heating-season",
    title: "Before the heating season",
    summary: "Seasonal prep for boilers, radiators, and frost risk before heating season.",
    body:
      "Watch proposed this subject because the heating-season window is approaching. " +
      "Capture official guidance and jurisdiction applicability before Accept.",
    months: [8, 9, 10],
    changeKind: "seasonal",
    label: "Heating season approaching",
  },
  {
    subjectKey: "chimney-flue-sweeping",
    title: "Chimney and flue sweeping",
    summary: "Chimney / flue sweeping obligations and seasonal timing.",
    body:
      "Watch proposed this subject for heating-season safety and compliance coverage. " +
      "Requires official sources and applicability before Accept.",
    months: [8, 9, 10],
    changeKind: "seasonal",
    label: "Heating season approaching",
  },
  {
    subjectKey: "gutters-autumn-leaf-risk",
    title: "Gutters and autumn leaf risk",
    summary: "Autumn gutter clearance and drainage risk.",
    body:
      "Watch proposed this subject for autumn leaf and drainage risk. " +
      "Requires official or authoritative sources before Accept.",
    months: [8, 9, 10],
    changeKind: "seasonal",
    label: "Autumn leaf risk",
  },
  {
    subjectKey: "smoke-carbon-monoxide-alarms",
    title: "Smoke and carbon monoxide alarms",
    summary: "Smoke and CO alarm requirements and testing guidance.",
    body:
      "Watch proposed this subject as a high-priority international safety coverage gap. " +
      "Requires jurisdiction-specific official sources before Accept.",
    months: null,
    changeKind: "knowledge_gap",
    label: "Knowledge gap",
  },
  {
    subjectKey: "anti-drowning-safety",
    title: "Anti-drowning and pool safety",
    summary: "Private pool / anti-drowning safety obligations where applicable.",
    body:
      "Watch proposed this subject as a coverage gap for jurisdictions with private pools. " +
      "Requires official sources before Accept.",
    months: [5, 6, 7],
    changeKind: "seasonal",
    label: "Summer pool season",
  },
  {
    subjectKey: "party-walls",
    title: "Party walls",
    summary: "Party wall / mitoyenneté obligations and neighbour notices.",
    body:
      "Watch proposed this subject as a regional coverage gap. " +
      "Requires official sources and applicability before Accept.",
    months: null,
    changeKind: "knowledge_gap",
    label: "Knowledge gap",
  },
  {
    subjectKey: "private-sewage-systems",
    title: "Private sewage systems",
    summary: "Private sewage / fosse septique maintenance and inspection obligations.",
    body:
      "Watch proposed this subject as a regional coverage gap. " +
      "Requires official sources and applicability before Accept.",
    months: null,
    changeKind: "knowledge_gap",
    label: "Knowledge gap",
  },
];

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const MAX_BODY_BYTES = 4_096;
const MAX_NEW_CANDIDATES_PER_RUN = 8;

function subjectKeyFromTitle(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/\s*[—–\-|:]\s*(france|scotland|england|wales|uk|germany|switzerland|ch|fr|de|gb)\s*$/i, "")
    .trim();
  if (/chimney|flue|ramonage|sweep/.test(base)) return "chimney-flue-sweeping";
  if (/gutter|gouttière|autumn/.test(base)) return "gutters-autumn-leaf-risk";
  if (/heating|boiler|frost|radiator/.test(base)) return "before-heating-season";
  if (/smoke|carbon monoxide|co\s*alarm/.test(base)) return "smoke-carbon-monoxide-alarms";
  if (/drown|piscine|pool/.test(base)) return "anti-drowning-safety";
  if (/sewage|septic|fosse/.test(base)) return "private-sewage-systems";
  if (/party\s*wall|mitoyen/.test(base)) return "party-walls";
  return base.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "subject";
}

type KnowledgeLite = {
  id: string;
  title: string;
  status: string;
  source_kind: string | null;
  updated_at: string;
  applicability: Record<string, unknown> | null;
};

type SubjectBucket = {
  subjectKey: string;
  title: string;
  rows: KnowledgeLite[];
  hasVerifiedOrPublished: boolean;
  hasCandidate: boolean;
  hasStale: boolean;
};

type CreatedCandidate = { id: string; kind: string; subjectKey?: string };

async function markWatchRunFailed(
  admin: ReturnType<typeof createClient>,
  runId: string,
  error: unknown
) {
  const message = error instanceof Error ? error.message : String(error);
  await admin
    .from("knowledge_watch_runs")
    .update({
      status: "failed",
      finished_at: new Date().toISOString(),
      summary: "Watch run failed",
      error_message: message.slice(0, 500),
    })
    .eq("id", runId);
}

type CatalogueScanStats = {
  sections_scanned: number;
  pages_upserted: number;
  new_guidance: number;
  guidance_changed: number;
  potential_change: number;
  withdrawn: number;
  stale_marked: number;
  adapter_errors: string[];
  searches_used: number;
  bodies_fetched: number;
};

type WatchAdmin = ReturnType<typeof createClient>;

async function runCatalogueReviewPass(input: {
  admin: WatchAdmin;
  runId: string;
  usage: WatchUsage;
  period: string;
  researchAllowance: ResearchAllowance;
  automatedResearch: AutomatedResearchMode;
  trigger: "scheduled" | "manual";
}): Promise<Response> {
  const gate = checkResearchAllowance({
    automatedResearch: input.automatedResearch,
    allowance: input.researchAllowance,
    usage: input.usage,
    trigger: input.trigger,
    need: { searches: 1, pages: 0 },
  });

  const generatedAt = new Date().toISOString();
  let report = {
    ...ENGLAND_HOUSING_ORIENTATION_REVIEW,
    generated_at: generatedAt,
  };
  let searchesUsed = 0;
  let adapterError: string | null = null;

  if (gate.ok) {
    const sample = await sampleGovukSearch(
      {
        taxonId: GOVUK_HOUSING_TAXON_ID,
        purposeSupergroup: "services",
        count: 50,
      },
      3
    );
    searchesUsed = sample.ok ? Math.min(3, Math.max(1, Math.ceil(sample.results.length / 50))) : 1;
    if (!sample.ok) {
      adapterError = sample.error;
      report = {
        ...ENGLAND_HOUSING_ORIENTATION_REVIEW,
        generated_at: generatedAt,
        adapter_error: adapterError,
        note: `${ENGLAND_HOUSING_ORIENTATION_REVIEW.note} Search adapter failed (${adapterError}) — orientation counts kept.`,
      };
    } else {
      report = buildCatalogueReviewReport({
        hits: sample.results,
        totalFound: sample.total,
        adapterError: null,
        generatedAt,
      });
    }
  } else {
    report = {
      ...ENGLAND_HOUSING_ORIENTATION_REVIEW,
      generated_at: generatedAt,
      adapter_error: gate.message,
    };
  }

  await input.admin
    .from("knowledge_watch_settings")
    .update({ catalogue_review: report, updated_at: generatedAt })
    .eq("id", "default");

  if (searchesUsed > 0) {
    const { data: usageExisting } = await input.admin
      .from("knowledge_watch_usage")
      .select("*")
      .eq("period_ym", input.period)
      .maybeSingle();
    if (usageExisting) {
      await input.admin
        .from("knowledge_watch_usage")
        .update({
          searches_used: Number(usageExisting.searches_used ?? 0) + searchesUsed,
          updated_at: generatedAt,
        })
        .eq("period_ym", input.period);
    } else {
      await input.admin.from("knowledge_watch_usage").insert({
        period_ym: input.period,
        searches_used: searchesUsed,
      });
    }
  }

  const summary = adapterError
    ? `Catalogue review used orientation counts — Search adapter failed (${adapterError}).`
    : `${report.seed_label}: ${report.total_found} service results found. ${report.relevant_count} appear relevant to property management. ${report.compliance_guidance_count} are likely compliance guidance. ${report.excluded_count} transactional or resident-service pages excluded.`;

  await input.admin
    .from("knowledge_watch_runs")
    .update({
      status: "succeeded",
      finished_at: generatedAt,
      summary,
      sources_checked: [{ id: "govuk_search", label: "GOV.UK Search adapter (unsupported)" }],
      searches_used: searchesUsed,
      detail: { phase: "catalogue_review", report },
    })
    .eq("id", input.runId);

  return json({
    ok: true,
    status: "succeeded",
    run_id: input.runId,
    summary,
    phase: "catalogue_review",
    report,
  });
}

async function scanAcceptedCatalogue(input: {
  admin: WatchAdmin;
  runId: string;
  detectedAt: string;
  usage: WatchUsage;
  researchAllowance: ResearchAllowance;
  automatedResearch: AutomatedResearchMode;
  trigger: "scheduled" | "manual";
}): Promise<CatalogueScanStats> {
  const stats: CatalogueScanStats = {
    sections_scanned: 0,
    pages_upserted: 0,
    new_guidance: 0,
    guidance_changed: 0,
    potential_change: 0,
    withdrawn: 0,
    stale_marked: 0,
    adapter_errors: [],
    searches_used: 0,
    bodies_fetched: 0,
  };

  const { data: sectionRows } = await input.admin
    .from("knowledge_source_catalogue")
    .select("*")
    .eq("status", "accepted")
    .limit(12);

  const sections = (sectionRows ?? []) as Array<{
    id: string;
    last_scan_at: string | null;
    poll_interval_hours: number;
  }>;
  if (sections.length === 0) return stats;

  const { data: sourceRows } = await input.admin
    .from("knowledge_sources")
    .select("knowledge_id, url")
    .not("url", "is", null)
    .limit(2000);
  const knowledgeIdsByPath: Record<string, string[]> = {};
  for (const row of sourceRows ?? []) {
    const url = typeof row.url === "string" ? row.url : "";
    if (!url) continue;
    try {
      const path = new URL(url).pathname.replace(/\/+$/, "") || "/";
      const list = knowledgeIdsByPath[path] ?? [];
      if (typeof row.knowledge_id === "string" && !list.includes(row.knowledge_id)) {
        list.push(row.knowledge_id);
        knowledgeIdsByPath[path] = list;
      }
    } catch {
      /* ignore */
    }
  }

  const now = new Date(input.detectedAt).getTime();

  for (const row of sections) {
    const seed = catalogueSectionById(row.id);
    if (!seed) continue;
    const intervalMs = Math.max(1, row.poll_interval_hours || seed.poll_interval_hours) * 3600_000;
    if (row.last_scan_at) {
      const last = new Date(row.last_scan_at).getTime();
      if (Number.isFinite(last) && now - last < intervalMs) continue;
    }

    const searchGate = checkResearchAllowance({
      automatedResearch: input.automatedResearch,
      allowance: input.researchAllowance,
      usage: {
        ...input.usage,
        searches_used: input.usage.searches_used + stats.searches_used,
        pages_used: input.usage.pages_used + stats.bodies_fetched,
      },
      trigger: input.trigger,
      need: { searches: 1 },
    });

    const { data: existingRows } = await input.admin
      .from("knowledge_source_catalogue_pages")
      .select(
        "canonical_path, content_id, public_updated_at, section_hash, status, detection, knowledge_ids"
      )
      .eq("catalogue_id", row.id)
      .limit(400);

    const existing = (existingRows ?? []).map((p) => ({
      canonical_path: String(p.canonical_path),
      content_id: typeof p.content_id === "string" ? p.content_id : null,
      public_updated_at: typeof p.public_updated_at === "string" ? p.public_updated_at : null,
      section_hash: typeof p.section_hash === "string" ? p.section_hash : null,
      status: p.status as "tracked" | "assessing" | "withdrawn" | "ignored",
      detection: p.detection as
        | "none"
        | "new_guidance"
        | "guidance_changed"
        | "potential_change"
        | "withdrawn",
      knowledge_ids: Array.isArray(p.knowledge_ids)
        ? p.knowledge_ids.filter((id): id is string => typeof id === "string")
        : [],
    }));

    const hits: import("../_shared/officialSourceCatalogue.ts").CatalogueSearchHit[] = [];
    let scanError: string | null = null;

    if (seed.locator.adapter === "govuk_search" && searchGate.ok) {
      const coverage = await sampleGovukSearch(
        {
          organisation: seed.locator.organisation_slug,
          q: seed.locator.path_prefixes[0]?.replace(/^\//, "").replace(/-/g, " "),
          purposeSupergroup: "guidance",
          count: 20,
        },
        1
      );
      stats.searches_used += 1;
      if (coverage.ok) hits.push(...coverage.results);
      else {
        scanError = coverage.error;
        stats.adapter_errors.push(`${row.id}: ${coverage.error}`);
      }

      if (seed.locator.news_query) {
        const newsGate = checkResearchAllowance({
          automatedResearch: input.automatedResearch,
          allowance: input.researchAllowance,
          usage: {
            ...input.usage,
            searches_used: input.usage.searches_used + stats.searches_used,
          },
          trigger: input.trigger,
          need: { searches: 1 },
        });
        if (newsGate.ok) {
          const news = await sampleGovukSearch(
            {
              q: seed.locator.news_query,
              purposeSupergroup: "news_and_communications",
              count: 10,
            },
            1
          );
          stats.searches_used += 1;
          if (news.ok) hits.push(...news.results);
          else stats.adapter_errors.push(`${row.id} news: ${news.error}`);
        }
      }
    } else if (seed.locator.adapter === "govuk_search" && !searchGate.ok) {
      scanError = searchGate.message;
    }

    const planned = planCataloguePageUpserts({
      section: seed,
      existing,
      hits,
      knowledgeIdsByPath,
    });

    for (const upsert of planned.upserts.slice(0, 40)) {
      let detection = upsert.detection;
      let status = upsert.status;
      let sectionHash: string | null = existing.find((e) => e.canonical_path === upsert.canonical_path)
        ?.section_hash ?? null;
      let fetchBody = upsert.fetch_body;

      if (seed.publisher === "gov.uk" && upsert.canonical_path.startsWith("/")) {
        const prev = existing.find((e) => e.canonical_path === upsert.canonical_path) ?? null;
        const metadataChanged = shouldFetchCataloguePageBody({
          previous: prev,
          next: {
            content_id: upsert.content_id ?? null,
            public_updated_at: upsert.public_updated_at ?? null,
          },
        });
        const needsContent = Boolean(prev && (metadataChanged || !prev.public_updated_at));
        if (needsContent && prev) {
          const content = await fetchGovukContent(upsert.canonical_path);
          if (!content.ok) {
            if (content.status === 410) {
              const withdrawn = planMetadataRefresh({
                previous: prev,
                withdrawn: true,
                knowledgeIds: upsert.knowledge_ids,
              });
              detection = withdrawn.detection;
              status = withdrawn.status;
              stats.withdrawn += 1;
            }
          } else {
            const refresh = planMetadataRefresh({
              previous: prev,
              nextContentId: content.metadata.content_id,
              nextPublicUpdatedAt: content.metadata.public_updated_at,
              withdrawn: content.metadata.withdrawn,
              knowledgeIds: upsert.knowledge_ids,
            });
            fetchBody = refresh.fetch_body;
            detection = refresh.detection;
            status = refresh.status;
            upsert.content_id = content.metadata.content_id;
            upsert.public_updated_at = content.metadata.public_updated_at;
            if (content.metadata.withdrawn) stats.withdrawn += 1;
            if (fetchBody && stats.bodies_fetched < 4) {
              const text = extractRelevantSectionText(content.raw);
              const nextHash = hashRelevantSections(text);
              stats.bodies_fetched += 1;
              if (sectionHash && nextHash !== sectionHash) {
                detection = "guidance_changed";
              } else if (!sectionHash) {
                detection = "none";
                status = "tracked";
              }
              sectionHash = nextHash;
            }
          }
        }
      }

      const { error: upsertErr } = await input.admin.from("knowledge_source_catalogue_pages").upsert(
        {
          catalogue_id: row.id,
          canonical_path: upsert.canonical_path,
          source_url: upsert.source_url,
          content_id: upsert.content_id,
          public_updated_at: upsert.public_updated_at,
          document_type: upsert.document_type,
          section_hash: sectionHash,
          status,
          detection,
          knowledge_ids: upsert.knowledge_ids,
          title: upsert.title,
          last_checked_at: input.detectedAt,
          updated_at: input.detectedAt,
        },
        { onConflict: "catalogue_id,canonical_path" }
      );
      if (upsertErr) {
        stats.adapter_errors.push(`${row.id} upsert: ${upsertErr.message}`);
        continue;
      }
      stats.pages_upserted += 1;
      if (detection === "new_guidance") stats.new_guidance += 1;
      if (detection === "guidance_changed") stats.guidance_changed += 1;
      if (detection === "potential_change") stats.potential_change += 1;

      if (detection === "guidance_changed" && upsert.knowledge_ids.length > 0) {
        stats.stale_marked += await markLinkedKnowledgeStale(
          input.admin,
          upsert.knowledge_ids,
          upsert.source_url,
          input.detectedAt,
          input.runId
        );
      }
    }

    const { count } = await input.admin
      .from("knowledge_source_catalogue_pages")
      .select("id", { count: "exact", head: true })
      .eq("catalogue_id", row.id);

    await input.admin
      .from("knowledge_source_catalogue")
      .update({
        last_scan_at: input.detectedAt,
        last_scan_ok: !scanError,
        last_scan_error: scanError,
        tracked_page_count: count ?? 0,
        updated_at: input.detectedAt,
      })
      .eq("id", row.id);

    stats.sections_scanned += 1;
  }

  return stats;
}

async function markLinkedKnowledgeStale(
  admin: WatchAdmin,
  knowledgeIds: string[],
  sourceUrl: string,
  detectedAt: string,
  runId: string
): Promise<number> {
  let marked = 0;
  const unique = [...new Set(knowledgeIds)].slice(0, 20);
  const label = formatMaterialChangeCopy({ affectedClaimCount: unique.length });
  for (const id of unique) {
    const { data: full } = await admin
      .from("knowledge")
      .select("id, status, provenance")
      .eq("id", id)
      .maybeSingle();
    if (!full?.id) continue;
    if (full.status !== "verified" && full.status !== "published") continue;
    const prev =
      full.provenance && typeof full.provenance === "object" && !Array.isArray(full.provenance)
        ? (full.provenance as Record<string, unknown>)
        : {};
    const prevWatch = Array.isArray(prev.watch) ? [...prev.watch] : [];
    prevWatch.unshift({
      change_kind: "official_guidance",
      label,
      url: sourceUrl,
      detected_at: detectedAt,
      run_id: runId,
    });
    const { error } = await admin
      .from("knowledge")
      .update({
        status: "stale",
        provenance: { ...prev, watch: prevWatch.slice(0, 8) },
        updated_at: detectedAt,
      })
      .eq("id", id)
      .in("status", ["verified", "published"]);
    if (!error) marked += 1;
  }
  return marked;
}

Deno.serve(async (req) => {
  try {
    return await handleWatchRequest(req);
  } catch (error) {
    console.error("[knowledge-watch-run] unhandled", error);
    return json(
      {
        ok: false,
        error: "watch_run_failed",
        message: error instanceof Error ? error.message : "Watch run failed",
      },
      500
    );
  }
});

async function handleWatchRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return corsPreflightResponse();
  if (req.method !== "POST") return json({ ok: false, error: "POST only" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const rawText = await req.text();
  if (rawText.length > MAX_BODY_BYTES) {
    return json({ ok: false, error: "payload_too_large" }, 413);
  }

  let trigger: "scheduled" | "manual" = "manual";
  let phase: "watch" | "catalogue_review" = "watch";
  try {
    const body = rawText ? JSON.parse(rawText) : {};
    if (body?.trigger === "scheduled" || body?.trigger === "manual") {
      trigger = body.trigger;
    }
    if (body?.phase === "catalogue_review") {
      phase = "catalogue_review";
    }
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return json({ ok: false, error: "server_misconfigured" }, 500);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const jwt = authHeader.slice("Bearer ".length).trim();
  let user: { id: string } | null = null;
  try {
    const { data, error: userErr } = await userClient.auth.getUser(jwt);
    user = data.user;
    if (userErr || !user) return json({ ok: false, error: "unauthorized" }, 401);
  } catch {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  if (!user) return json({ ok: false, error: "unauthorized" }, 401);

  try {
    const { data, error: adminErr } = await userClient.rpc("is_platform_admin");
    if (adminErr || data !== true) return json({ ok: false, error: "not_platform_admin" }, 403);
  } catch {
    return json({ ok: false, error: "not_platform_admin" }, 403);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: settingsRow } = await admin
    .from("knowledge_watch_settings")
    .select("automated_research, research_allowance")
    .eq("id", "default")
    .maybeSingle();

  const automatedResearch = (settingsRow?.automated_research ?? "paused") as AutomatedResearchMode;
  const researchAllowance = (settingsRow?.research_allowance ?? "light") as ResearchAllowance;

  const period = currentPeriodYm();
  const { data: usageRow } = await admin
    .from("knowledge_watch_usage")
    .select("*")
    .eq("period_ym", period)
    .maybeSingle();

  const usage: WatchUsage = {
    period_ym: period,
    searches_used: Number(usageRow?.searches_used ?? 0),
    pages_used: Number(usageRow?.pages_used ?? 0),
    tokens_used: Number(usageRow?.tokens_used ?? 0),
    cost_units_used: Number(usageRow?.cost_units_used ?? 0),
  };

  const { data: runRow, error: runInsertErr } = await admin
    .from("knowledge_watch_runs")
    .insert({
      trigger,
      status: "running",
      created_by: user.id,
      summary: "Watch run started",
    })
    .select("id")
    .single();

  if (runInsertErr || !runRow) {
    return json({ ok: false, error: "run_create_failed", message: runInsertErr?.message }, 500);
  }
  const runId = runRow.id as string;

  const gate = checkResearchAllowance({
    automatedResearch,
    allowance: researchAllowance,
    usage,
    trigger,
    need: { searches: 0, pages: 0, tokens: 0, cost_units: 0 },
  });

  if (!gate.ok && gate.reason === "paused") {
    await admin
      .from("knowledge_watch_runs")
      .update({
        status: "paused",
        finished_at: new Date().toISOString(),
        summary: "Skipped — automated research is paused.",
        skip_reasons: [{ reason: "paused", detail: gate.message }],
      })
      .eq("id", runId);
    return json({
      ok: true,
      status: "paused",
      run_id: runId,
      summary: "Automated research is paused. Turn it On or use Run Watch now.",
    });
  }

  if (phase === "catalogue_review") {
    try {
      return await runCatalogueReviewPass({
        admin,
        runId,
        usage,
        period,
        researchAllowance,
        automatedResearch,
        trigger,
      });
    } catch (error) {
      await markWatchRunFailed(admin, runId, error);
      throw error;
    }
  }

  const runPass = (async (): Promise<Response> => {
  const now = new Date();
  const detectedAt = now.toISOString();
  const month = now.getUTCMonth();
  const created: CreatedCandidate[] = [];
  const skipReasons: Array<{ subjectKey?: string; reason: string }> = [];
  const sourcesChecked: Array<{ id: string; label: string }> = [
    { id: "knowledge_index", label: "Existing platform Knowledge" },
    { id: "watch_pilot_catalog", label: "Watch pilot subject catalog" },
    { id: "knowledge_discovery", label: "Operational + community discovery" },
  ];

  // --- Free inventory pass -------------------------------------------------
  const { data: knowledgeRows } = await admin
    .from("knowledge")
    .select("id, title, status, source_kind, updated_at, applicability")
    .eq("scope", "platform")
    .neq("status", "archived")
    .limit(500);

  const rows = (knowledgeRows ?? []) as KnowledgeLite[];
  const byKey = new Map<string, SubjectBucket>();
  const coveredKeys = new Set<string>();

  for (const row of rows) {
    const subjectKey = subjectKeyFromTitle(row.title ?? "");
    coveredKeys.add(subjectKey);
    const bucket = byKey.get(subjectKey) ?? {
      subjectKey,
      title: row.title ?? subjectKey,
      rows: [],
      hasVerifiedOrPublished: false,
      hasCandidate: false,
      hasStale: false,
    };
    bucket.rows.push(row);
    if (row.status === "verified" || row.status === "published") {
      bucket.hasVerifiedOrPublished = true;
    }
    if (row.status === "candidate") bucket.hasCandidate = true;
    if (row.status === "stale") bucket.hasStale = true;
    byKey.set(subjectKey, bucket);
  }

  // --- Free detect: seasonal / coverage gap proposals ----------------------
  let subjectsProposed = 0;
  for (const subject of WATCH_DETECT_SUBJECTS) {
    if (created.length >= MAX_NEW_CANDIDATES_PER_RUN) break;
    if (coveredKeys.has(subject.subjectKey)) {
      skipReasons.push({
        subjectKey: subject.subjectKey,
        reason: "Already covered by existing platform Knowledge — not re-proposed.",
      });
      continue;
    }
    if (subject.months && !subject.months.includes(month)) {
      skipReasons.push({
        subjectKey: subject.subjectKey,
        reason: "Outside seasonal window for this pass.",
      });
      continue;
    }

    const { data: candidate, error } = await admin.rpc("create_knowledge_candidate", {
      p_scope: "platform",
      p_org_id: null,
      p_title: subject.title,
      p_summary: subject.summary,
      p_body: subject.body,
      p_source_kind: "filla_curated",
      p_content: {
        subject_key: subject.subjectKey,
        watch_proposed: true,
      },
      p_provenance: {
        discovery_function: "knowledge-watch-run",
        subject_key: subject.subjectKey,
        watch: [
          {
            change_kind: subject.changeKind,
            label: subject.label,
            detected_at: detectedAt,
          },
        ],
      },
      p_cohort_size: null,
      p_trust_score: null,
      p_created_by: user.id,
      p_applicability: { unscoped: true },
    });

    if (error || !candidate?.id) {
      skipReasons.push({
        subjectKey: subject.subjectKey,
        reason: `Could not create candidate: ${error?.message ?? "unknown"}`,
      });
      continue;
    }

    created.push({
      id: candidate.id,
      kind: subject.changeKind,
      subjectKey: subject.subjectKey,
    });
    subjectsProposed += 1;
    coveredKeys.add(subject.subjectKey);
    byKey.set(subject.subjectKey, {
      subjectKey: subject.subjectKey,
      title: subject.title,
      rows: [
        {
          id: candidate.id,
          title: subject.title,
          status: "candidate",
          source_kind: "filla_curated",
          updated_at: detectedAt,
        },
      ],
      hasVerifiedOrPublished: false,
      hasCandidate: true,
      hasStale: false,
    });

    fetch(`${supabaseUrl}/functions/v1/knowledge-critic`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        knowledge_id: candidate.id,
        org_id: "00000000-0000-0000-0000-000000000000",
        extractor_provider: "KNOWLEDGE_WATCH",
      }),
    }).catch(() => undefined);
  }

  // --- Free detect: reuse knowledge-discovery (org + community) ------------
  let discoveryCreated = 0;
  try {
    const discoveryRes = await fetch(`${supabaseUrl}/functions/v1/knowledge-discovery`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ mode: "all" }),
    });
    if (discoveryRes.ok) {
      const discoveryJson = (await discoveryRes.json()) as {
        created?: Array<{ id: string; kind: string }>;
        created_count?: number;
      };
      for (const item of discoveryJson.created ?? []) {
        if (created.length >= MAX_NEW_CANDIDATES_PER_RUN) break;
        created.push({ id: item.id, kind: item.kind });
        discoveryCreated += 1;
      }
    } else {
      skipReasons.push({
        reason: `knowledge-discovery returned ${discoveryRes.status} — continuing without it.`,
      });
    }
  } catch (e) {
    skipReasons.push({
      reason: `knowledge-discovery failed: ${e instanceof Error ? e.message : "unknown"}`,
    });
  }

  const subjects = [...byKey.values()];
  const researchQueue: SubjectBucket[] = [];

  let subjectsAlreadyCovered = 0;
  let subjectsInferredOnly = 0;
  let subjectsQueuedForResearch = 0;

  for (const subject of subjects) {
    const deep = shouldDeepResearch({
      hasKnownKnowledgeMatch: subject.hasVerifiedOrPublished,
      materialSignalCount: subject.hasCandidate ? 1 : 0,
      inferredOnly:
        subject.hasStale && !subject.hasCandidate && !subject.hasVerifiedOrPublished
          ? true
          : subject.hasStale && !subject.hasCandidate,
    });

    if (subject.hasVerifiedOrPublished && !subject.hasCandidate) {
      subjectsAlreadyCovered += 1;
      skipReasons.push({
        subjectKey: subject.subjectKey,
        reason: "Existing verified/published Knowledge covers this subject — no deep research.",
      });
      continue;
    }

    if (!deep.research) {
      subjectsInferredOnly += 1;
      skipReasons.push({
        subjectKey: subject.subjectKey,
        reason: deep.skipReason ?? "Skipped — not warranted for deep research.",
      });
      continue;
    }

    if (subject.hasCandidate && !subject.hasVerifiedOrPublished) {
      subjectsQueuedForResearch += 1;
      researchQueue.push(subject);
      continue;
    }

    subjectsAlreadyCovered += 1;
    skipReasons.push({
      subjectKey: subject.subjectKey,
      reason: "No material change requiring deep research.",
    });
  }

  // --- Paid research: external AI discovery + URL intake -------------------
  // 1 search = one knowledge-gap-research (Gemini Google Search) batch
  // 1 page  = one knowledge-intake-url fetch + analyse
  // Never auto-publish; candidates only.
  const gapBudget =
    researchAllowance === "thorough" ? 16 : researchAllowance === "standard" ? 10 : 6;
  const pageBudget =
    researchAllowance === "thorough" ? 6 : researchAllowance === "standard" ? 4 : 3;

  let searchesUsed = 0;
  let pagesUsed = 0;
  let tokensUsed = 0;
  let costUnitsUsed = 0;
  let stoppedAtLimit = false;
  let subjectsTouched = 0;
  let researchCandidatesCreated = 0;
  let sourcesFound = 0;
  let intakeFailed = 0;
  let sourcesNeedsRepair = 0;
  let catalogueScan: CatalogueScanStats | null = null;

  catalogueScan = await scanAcceptedCatalogue({
    admin,
    runId,
    detectedAt,
    usage,
    researchAllowance,
    automatedResearch,
    trigger,
  });
  searchesUsed += catalogueScan.searches_used;
  pagesUsed += catalogueScan.bodies_fetched;
  subjectsTouched += catalogueScan.stale_marked;
  if (catalogueScan.adapter_errors.length > 0) {
    skipReasons.push({
      reason: `Catalogue adapter: ${catalogueScan.adapter_errors.slice(0, 3).join("; ")}`,
    });
  }
  sourcesChecked.push({
    id: "official_source_catalogue",
    label: "Official Source Catalogue (metadata-first)",
  });

  type WatchGap = {
    id: string;
    topic_key: string;
    topic: string;
    jurisdiction: string;
    status: "missing" | "partial";
  };

  const gaps: WatchGap[] = [];
  const pushGap = (gap: WatchGap) => {
    if (gaps.length >= gapBudget) return;
    if (gaps.some((g) => g.id === gap.id)) return;
    gaps.push(gap);
  };

  // 1) International pilot coverage expansion — even when one jurisdiction is already published.
  // Chimney (France-only) must still research England / Scotland / Switzerland.
  for (const pilot of INTL_COVERAGE_PILOTS) {
    const bucket = byKey.get(pilot.subjectKey);
    const present = new Set<string>();
    for (const row of bucket?.rows ?? []) {
      for (const j of jurisdictionsFromApplicability(row.applicability)) {
        present.add(j.toLowerCase());
      }
    }
    const topic_key = pilot.subjectKey.slice(0, 48).toLowerCase();
    const topic = (bucket?.title ?? pilot.title).slice(0, 80);
    const hasAny = present.size > 0 || coveredKeys.has(pilot.subjectKey);
    for (const j of PRIORITY_JURISDICTIONS) {
      if (present.has(j.toLowerCase())) continue;
      pushGap({
        id: `${topic_key}::${j.toLowerCase().replace(/\s+/g, "-")}`.slice(0, 160),
        topic_key,
        topic,
        jurisdiction: j.slice(0, 80),
        status: hasAny ? "partial" : "missing",
      });
    }
  }

  // 2) Candidate subjects without verified cover (existing research queue).
  for (const subject of researchQueue) {
    const topic_key = subject.subjectKey.slice(0, 48).toLowerCase();
    const topic = subject.title.slice(0, 80);
    const present = new Set<string>();
    for (const row of subject.rows) {
      for (const j of jurisdictionsFromApplicability(row.applicability)) {
        present.add(j.toLowerCase());
      }
    }
    for (const j of PRIORITY_JURISDICTIONS) {
      if (present.has(j.toLowerCase())) continue;
      pushGap({
        id: `${topic_key}::${j.toLowerCase().replace(/\s+/g, "-")}`.slice(0, 160),
        topic_key,
        topic,
        jurisdiction: j.slice(0, 80),
        status: subject.hasVerifiedOrPublished ? "partial" : "missing",
      });
    }
  }

  // 3) Seasonal catalog fill-in when still thin.
  if (gaps.length < Math.min(4, gapBudget)) {
    for (const pilot of WATCH_DETECT_SUBJECTS) {
      if (pilot.months && !pilot.months.includes(month)) continue;
      const topic_key = pilot.subjectKey.slice(0, 48).toLowerCase();
      const topic = pilot.title.slice(0, 80);
      for (const j of PRIORITY_JURISDICTIONS.slice(0, 2)) {
        pushGap({
          id: `${topic_key}::${j.toLowerCase().replace(/\s+/g, "-")}`.slice(0, 160),
          topic_key,
          topic,
          jurisdiction: j.slice(0, 80),
          status: coveredKeys.has(pilot.subjectKey) ? "partial" : "missing",
        });
      }
    }
  }

  if (gaps.some((g) => g.topic_key === "chimney-flue-sweeping")) {
    skipReasons.push({
      subjectKey: "chimney-flue-sweeping",
      reason:
        "International coverage incomplete — researching missing jurisdictions (France already sourced).",
    });
  }

  const spendGate = checkResearchAllowance({
    automatedResearch,
    allowance: researchAllowance,
    usage: {
      ...usage,
      searches_used: usage.searches_used + searchesUsed,
      pages_used: usage.pages_used + pagesUsed,
    },
    trigger,
    need: { searches: 1, pages: 1 },
  });

  if (gaps.length === 0) {
    skipReasons.push({ reason: "No research gaps to investigate this pass." });
  } else if (!spendGate.ok) {
    stoppedAtLimit = spendGate.reason !== "paused";
    skipReasons.push({
      reason: `${spendGate.message} External AI research deferred (${gaps.length} gaps ready).`,
    });
    // Light touch so the queue still shows Watch ran.
    for (const subject of researchQueue.slice(0, 10)) {
      const row = subject.rows.find((r) => r.status === "candidate");
      if (!row) continue;
      const { data: full } = await admin
        .from("knowledge")
        .select("id, provenance")
        .eq("id", row.id)
        .maybeSingle();
      if (!full?.id) continue;
      const prev =
        full.provenance && typeof full.provenance === "object" && !Array.isArray(full.provenance)
          ? (full.provenance as Record<string, unknown>)
          : {};
      const prevWatch = Array.isArray(prev.watch) ? [...prev.watch] : [];
      prevWatch.unshift({
        change_kind: "knowledge_gap",
        label: "Watch: research deferred (allowance)",
        detected_at: detectedAt,
        run_id: runId,
      });
      const { error: touchErr } = await admin
        .from("knowledge")
        .update({
          provenance: { ...prev, watch: prevWatch.slice(0, 8) },
          updated_at: detectedAt,
        })
        .eq("id", row.id);
      if (!touchErr) subjectsTouched += 1;
    }
  } else {
    sourcesChecked.push({
      id: "knowledge_gap_research",
      label: "External AI official-source discovery",
    });

    type SourceHit = {
      url: string;
      title?: string;
      publisher?: string;
      covers?: string[];
    };

    let sources: SourceHit[] = [];
    try {
      const researchRes = await fetch(`${supabaseUrl}/functions/v1/knowledge-gap-research`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify({ gaps }),
      });
      const researchJson = (await researchRes.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        sources?: SourceHit[];
        uncovered?: string[];
      };
      if (!researchRes.ok || researchJson.ok === false) {
        skipReasons.push({
          reason: `Gap research failed: ${researchJson.error ?? researchRes.status}`,
        });
      } else {
        sources = (researchJson.sources ?? []).filter((s) => typeof s.url === "string");
        sourcesFound = sources.length;
        searchesUsed = 1;
        costUnitsUsed += 1;
        skipReasons.push({
          reason: `AI discovery returned ${sourcesFound} official source(s) for ${gaps.length} gap(s).`,
        });
        if ((researchJson.uncovered ?? []).length > 0) {
          skipReasons.push({
            reason: `${researchJson.uncovered!.length} gap(s) had no precise official URL.`,
          });
        }
      }
    } catch (e) {
      skipReasons.push({
        reason: `Gap research error: ${e instanceof Error ? e.message : "unknown"}`,
      });
    }

    const titlesExisting = new Set(
      rows.map((r) => (r.title ?? "").trim().toLowerCase()).filter(Boolean)
    );

    // Validate allowlist → probe fetchability → only then spend a page on intake.
    const fetchableSources: Array<SourceHit & { url: string }> = [];
    for (const source of sources) {
      const validated = validateOfficialSourceUrl(source.url);
      if (!validated.ok) {
        sourcesNeedsRepair += 1;
        skipReasons.push({
          reason: `source needs repair — ${validated.detail} (${source.url})`,
        });
        continue;
      }
      if (validated.repaired) {
        skipReasons.push({
          reason: `Repaired official URL typo: ${source.url} → ${validated.url}`,
        });
      }

      const probe = await probeOfficialSourceUrl(validated.url);
      if (!probe.ok) {
        sourcesNeedsRepair += 1;
        skipReasons.push({
          reason: `source needs repair — ${probe.reason}: ${probe.detail} (${probe.proposedUrl}${
            probe.finalUrl ? ` → ${probe.finalUrl}` : ""
          })`,
        });
        continue;
      }

      fetchableSources.push({
        ...source,
        url: probe.finalUrl,
      });
    }

    if (sourcesNeedsRepair > 0) {
      skipReasons.push({
        reason: `${sourcesNeedsRepair} discovered URL(s) labelled “source needs repair” (not queued for content review).`,
      });
    }

    for (const source of fetchableSources.slice(0, pageBudget)) {
      const pageGate = checkResearchAllowance({
        automatedResearch,
        allowance: researchAllowance,
        usage: {
          ...usage,
          searches_used: usage.searches_used + searchesUsed,
          pages_used: usage.pages_used + pagesUsed,
          tokens_used: usage.tokens_used + tokensUsed,
          cost_units_used: usage.cost_units_used + costUnitsUsed,
        },
        trigger,
        need: { searches: 0, pages: 1 },
      });
      if (!pageGate.ok) {
        stoppedAtLimit = true;
        skipReasons.push({ reason: `${pageGate.message} Further URL intake stopped.` });
        break;
      }

      try {
        const intakeRes = await fetch(`${supabaseUrl}/functions/v1/knowledge-intake-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify({ url: source.url }),
        });
        pagesUsed += 1;
        const intakeJson = (await intakeRes.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          source?: { source_url?: string; final_url?: string; retrieved_date?: string };
          analysis?: {
            knowledge_proposals?: Array<{
              title?: string;
              summary?: string;
              body?: string;
              attributes?: Record<string, unknown>;
            }>;
            title?: string;
            summary?: string;
          };
        };
        if (!intakeRes.ok || intakeJson.ok === false) {
          intakeFailed += 1;
          sourcesNeedsRepair += 1;
          skipReasons.push({
            reason: `source needs repair — intake failed: ${intakeJson.error ?? intakeRes.status} (${source.url})`,
          });
          continue;
        }

        const pageText =
          typeof intakeJson.analysis?.ocr_text === "string"
            ? intakeJson.analysis.ocr_text.trim()
            : "";
        const rawProposals = Array.isArray(intakeJson.analysis?.knowledge_proposals)
          ? intakeJson.analysis!.knowledge_proposals!
          : [];
        const proposals = rawProposals.map((p) => {
          const body = (p.body ?? "").trim();
          if (body.length >= 80 || pageText.length < 80) return p;
          return {
            ...p,
            body: pageText,
            summary: (p.summary ?? "").trim() || pageText.slice(0, 400),
          };
        });
        const fallbackTitle =
          (typeof source.title === "string" && source.title.trim()) ||
          (typeof intakeJson.analysis?.title === "string" && intakeJson.analysis.title.trim()) ||
          null;

        const toCreate =
          proposals.length > 0
            ? proposals.slice(0, 4)
            : fallbackTitle && pageText.length >= 80
              ? [
                  {
                    title: fallbackTitle,
                    summary:
                      (typeof intakeJson.analysis?.summary === "string" &&
                        intakeJson.analysis.summary) ||
                      pageText.slice(0, 400),
                    body: pageText,
                    attributes: {},
                  },
                ]
              : fallbackTitle
                ? [
                    {
                      title: fallbackTitle,
                      summary:
                        (typeof intakeJson.analysis?.summary === "string" &&
                          intakeJson.analysis.summary) ||
                        `Official source proposed by Watch for ${source.covers?.join(", ") ?? "coverage gaps"}.`,
                      body: `Source: ${source.url}. Review and Accept before publish.`,
                      attributes: {},
                    },
                  ]
              : [];

        if (toCreate.length === 0) {
          sourcesNeedsRepair += 1;
          skipReasons.push({
            reason: `source needs repair — no extractable knowledge proposals (${source.url})`,
          });
          continue;
        }

        const coveredGaps = (source.covers ?? [])
          .map((id) => gaps.find((g) => g.id === id))
          .filter((g): g is WatchGap => Boolean(g));
        const jurisdictions = [
          ...new Set(coveredGaps.map((g) => g.jurisdiction).filter(Boolean)),
        ];

        for (const proposal of toCreate) {
          if (created.length >= MAX_NEW_CANDIDATES_PER_RUN) break;
          const primaryGap = coveredGaps[0];
          const title =
            titleFromResearchContext({
              proposalTitle: proposal.title,
              sourceTitle: source.title,
              topic: primaryGap?.topic ?? null,
              jurisdiction: jurisdictions[0] ?? primaryGap?.jurisdiction ?? null,
            }) ?? "";
          if (!title) {
            sourcesNeedsRepair += 1;
            skipReasons.push({
              reason: `source needs repair — opaque or missing title after intake (${source.url})`,
            });
            continue;
          }
          if (
            !hasReviewableKnowledgeBody({
              summary: proposal.summary,
              body: proposal.body,
            })
          ) {
            sourcesNeedsRepair += 1;
            skipReasons.push({
              reason: `source needs repair — empty guidance body after intake (${source.url})`,
            });
            continue;
          }
          const titleKey = title.toLowerCase();
          if (titlesExisting.has(titleKey)) continue;
          titlesExisting.add(titleKey);

          const { data: candidate, error: createErr } = await admin.rpc(
            "create_knowledge_candidate",
            {
              p_scope: "platform",
              p_org_id: null,
              p_title: title,
              p_summary: (proposal.summary ?? "").slice(0, 500) || null,
              p_body: (proposal.body ?? "").slice(0, 4000) || null,
              p_source_kind: "filla_curated",
              p_content: {
                watch_researched: true,
                attributes:
                  proposal.attributes && typeof proposal.attributes === "object"
                    ? proposal.attributes
                    : {},
              },
              p_provenance: {
                discovery_function: "knowledge-watch-run",
                intake_mode: "url",
                source_url: intakeJson.source?.final_url || source.url,
                retrieved_date: intakeJson.source?.retrieved_date ?? detectedAt,
                publisher: source.publisher ?? null,
                watch: [
                  {
                    change_kind: "knowledge_gap",
                    label: "Watch AI research",
                    detected_at: detectedAt,
                    run_id: runId,
                    url: source.url,
                  },
                ],
              },
              p_cohort_size: null,
              p_trust_score: null,
              p_created_by: user.id,
              p_applicability:
                jurisdictions.length > 0
                  ? { jurisdictions, unscoped: false }
                  : { unscoped: true },
            }
          );

          if (createErr || !candidate?.id) {
            intakeFailed += 1;
            skipReasons.push({
              reason: `Could not create candidate “${title}”: ${createErr?.message ?? "unknown"}`,
            });
            continue;
          }

          created.push({
            id: candidate.id,
            kind: "watch_research",
            subjectKey: subjectKeyFromTitle(title),
          });
          researchCandidatesCreated += 1;

          // Chain claims extraction → critic so Review shows supported actions
          // and a check state without any manual click. Both are bounded per
          // candidate, metered against the platform AI allowance, and never
          // change status — candidates still require human Accept.
          const chainReviewPrep = async () => {
            try {
              await fetch(`${supabaseUrl}/functions/v1/knowledge-extract-claims`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${serviceKey}`,
                },
                body: JSON.stringify({ knowledge_id: candidate.id }),
              });
            } catch {
              // Claims are an enrichment — critic still runs without them.
            }
            await fetch(`${supabaseUrl}/functions/v1/knowledge-critic`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                knowledge_id: candidate.id,
                org_id: "00000000-0000-0000-0000-000000000000",
                extractor_provider: "KNOWLEDGE_WATCH",
              }),
            });
          };
          chainReviewPrep().catch(() => undefined);
        }
      } catch (e) {
        intakeFailed += 1;
        sourcesNeedsRepair += 1;
        pagesUsed += 1;
        skipReasons.push({
          reason: `source needs repair — intake error: ${
            e instanceof Error ? e.message : "unknown"
          } (${source.url})`,
        });
      }
    }
  }

  if (searchesUsed > 0 || pagesUsed > 0 || tokensUsed > 0 || costUnitsUsed > 0) {
    const { data: usageExisting } = await admin
      .from("knowledge_watch_usage")
      .select("*")
      .eq("period_ym", period)
      .maybeSingle();
    if (usageExisting) {
      await admin
        .from("knowledge_watch_usage")
        .update({
          searches_used: Number(usageExisting.searches_used ?? 0) + searchesUsed,
          pages_used: Number(usageExisting.pages_used ?? 0) + pagesUsed,
          tokens_used: Number(usageExisting.tokens_used ?? 0) + tokensUsed,
          cost_units_used: Number(usageExisting.cost_units_used ?? 0) + costUnitsUsed,
          updated_at: new Date().toISOString(),
        })
        .eq("period_ym", period);
    } else {
      await admin.from("knowledge_watch_usage").insert({
        period_ym: period,
        searches_used: searchesUsed,
        pages_used: pagesUsed,
        tokens_used: tokensUsed,
        cost_units_used: costUnitsUsed,
      });
    }
  }

  const subjectsAdded = created.length;
  const status = stoppedAtLimit ? "stopped_at_limit" : "succeeded";
  const summaryParts = [
    `Reviewed ${subjects.length} subjects (${rows.length} Knowledge rows).`,
    subjectsProposed > 0 || discoveryCreated > 0
      ? `${subjectsProposed} catalog · ${discoveryCreated} discovery`
      : null,
    searchesUsed > 0
      ? `AI research: ${sourcesFound} sources · ${researchCandidatesCreated} new candidates · ${pagesUsed} pages`
      : gaps.length > 0
        ? `External AI research did not complete (${gaps.length} gaps queued)`
        : "No gaps queued for AI research",
    `${subjectsAlreadyCovered} published/covered`,
    subjectsTouched > 0 ? `${subjectsTouched} re-marked` : null,
    sourcesNeedsRepair > 0 ? `${sourcesNeedsRepair} source needs repair` : null,
    intakeFailed > 0 ? `${intakeFailed} intake failures` : null,
    catalogueScan
      ? `Catalogue: ${catalogueScan.sections_scanned} sections · ${catalogueScan.potential_change} potential change · ${catalogueScan.guidance_changed} guidance changed`
      : null,
    `${searchesUsed} searches used`,
  ].filter(Boolean);
  const summary = summaryParts.join(" · ");

  await admin
    .from("knowledge_watch_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      summary,
      sources_checked: sourcesChecked,
      subjects_added: subjectsAdded,
      subjects_updated: subjectsTouched + researchCandidatesCreated,
      searches_used: searchesUsed,
      pages_used: pagesUsed,
      tokens_used: tokensUsed,
      cost_units_used: costUnitsUsed,
      skip_reasons: skipReasons.slice(0, 100),
      detail: {
        allowance: researchAllowance,
        automated_research: automatedResearch,
        trigger,
        period_ym: period,
        subject_count: subjects.length,
        knowledge_row_count: rows.length,
        already_covered: subjectsAlreadyCovered,
        deferred: subjectsInferredOnly,
        flagged_for_research: subjectsQueuedForResearch,
        subjects_touched: subjectsTouched,
        gaps_queued: gaps.length,
        sources_found: sourcesFound,
        research_candidates_created: researchCandidatesCreated,
        intake_failed: intakeFailed,
        sources_needs_repair: sourcesNeedsRepair,
        research_queue_keys: researchQueue.map((s) => s.subjectKey).slice(0, 40),
        proposed_subject_keys: created
          .map((c) => c.subjectKey)
          .filter(Boolean)
          .slice(0, 40),
        created_ids: created.map((c) => c.id).slice(0, 40),
        catalogue: catalogueScan,
        note:
          searchesUsed > 0
            ? "Catalogue metadata scan plus optional AI gap research. Candidates only — never auto-published. News is Potential change, not Knowledge."
            : "Catalogue metadata scan only. No Knowledge created from detections.",
      },
    })
    .eq("id", runId);

  return json({
    ok: true,
    status,
    run_id: runId,
    summary,
    subjects_added: subjectsAdded,
    created,
    usage: {
      period_ym: period,
      searches_used: usage.searches_used + searchesUsed,
      pages_used: usage.pages_used + pagesUsed,
      tokens_used: usage.tokens_used + tokensUsed,
      cost_units_used: usage.cost_units_used + costUnitsUsed,
    },
  });
  })();

  const waitUntil = (
    globalThis as unknown as {
      EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void };
    }
  ).EdgeRuntime?.waitUntil;

  if (typeof waitUntil === "function") {
    waitUntil(
      runPass.then(
        () => undefined,
        async (error) => {
          await markWatchRunFailed(admin, runId, error);
        }
      )
    );
    return json({
      ok: true,
      status: "running",
      run_id: runId,
      summary:
        "Watch started. Research continues in the background — new candidates appear in the queue. Nothing is published.",
    });
  }

  try {
    return await runPass;
  } catch (error) {
    await markWatchRunFailed(admin, runId, error);
    throw error;
  }
}
