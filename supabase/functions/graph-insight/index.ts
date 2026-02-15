/**
 * graph-insight — Phase 13B FILLA Graph Insight Layer
 * Read-only. Computes centrality, hazard exposure, compliance influence, task impact, risk paths.
 * Uses property_graph_edges only. No DB writes.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GraphInsightInput {
  org_id: string;
  start: { type: string; id: string };
  depth?: number;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function nodeKey(type: string, id: string) {
  return `${type}:${id}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "POST only" }, 405);

  let body: GraphInsightInput;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const { org_id: orgId, start, depth: rawDepth = 3 } = body;
  if (!orgId || !start?.type || !start?.id) {
    return jsonResponse({ ok: false, error: "org_id and start { type, id } required" }, 400);
  }
  const depth = Math.min(3, Math.max(1, rawDepth ?? 3));

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    const { data: edges, error: edgesErr } = await supabase
      .from("property_graph_edges")
      .select("source_type, source_id, target_type, target_id, relationship, weight, metadata")
      .eq("org_id", orgId);

    if (edgesErr) throw edgesErr;

    const edgeList = (edges ?? []) as Array<{
      source_type: string;
      source_id: string;
      target_type: string;
      target_id: string;
      relationship: string;
      weight?: number;
      metadata?: { hazard_type?: string };
    }>;

    const startKey = nodeKey(start.type, start.id);

    const adj = new Map<string, Array<{ to: string; rel: string; weight?: number }>>();
    for (const e of edgeList) {
      const fromKey = nodeKey(e.source_type, e.source_id);
      const toKey = nodeKey(e.target_type, e.target_id);
      if (!adj.has(fromKey)) adj.set(fromKey, []);
      adj.get(fromKey)!.push({ to: toKey, rel: e.relationship, weight: e.weight });
      if (!adj.has(toKey)) adj.set(toKey, []);
      adj.get(toKey)!.push({ to: fromKey, rel: e.relationship, weight: e.weight });
    }

    const visited = new Set<string>();
    const dist = new Map<string, number>();
    const nodeTypes = new Map<string, string>();
    const queue: Array<{ key: string; d: number }> = [{ key: startKey, d: 0 }];
    visited.add(startKey);
    dist.set(startKey, 0);
    nodeTypes.set(startKey, start.type);

    while (queue.length > 0) {
      const { key, d } = queue.shift!();
      if (d >= depth) continue;
      for (const { to } of adj.get(key) ?? []) {
        const [tt] = to.split(":");
        if (!visited.has(to)) {
          visited.add(to);
          dist.set(to, d + 1);
          nodeTypes.set(to, tt);
          queue.push({ key: to, d: d + 1 });
        }
      }
    }

    const maxDegree = Math.max(1, visited.size - 1);
    const degree = (adj.get(startKey)?.length ?? 0);
    const centrality = Math.min(1, degree / maxDegree);

    let hazardExposure = 0;
    for (const [key, d] of dist) {
      if (nodeTypes.get(key) === "hazard") {
        const weight = edgeList.find(
          (e) =>
            nodeKey(e.source_type, e.source_id) === key || nodeKey(e.target_type, e.target_id) === key
        )?.weight ?? 1;
        hazardExposure += weight / (d + 1);
      }
    }

    const reachableAssets = new Set<string>();
    const reachableSpaces = new Set<string>();
    const reachableCompliance = new Set<string>();
    const reachableHazards = new Set<string>();
    for (const [key, d] of dist) {
      const t = nodeTypes.get(key);
      if (t === "asset") reachableAssets.add(key);
      if (t === "space") reachableSpaces.add(key);
      if (t === "compliance") reachableCompliance.add(key);
      if (t === "hazard") reachableHazards.add(key);
    }

    const complianceInfluence =
      start.type === "compliance"
        ? reachableAssets.size + reachableSpaces.size
        : reachableCompliance.size;

    const taskImpact = start.type === "task"
      ? reachableAssets.size + reachableCompliance.size + (reachableHazards.size > 0 ? 1 : 0)
      : reachableCompliance.size + reachableAssets.size;

    const riskPaths: string[][] = [];

    function findPaths(
      from: string,
      path: string[],
      seen: Set<string>,
      targetOrder: string[]
    ) {
      if (path.length >= 5) return;
      const fromType = nodeTypes.get(from);
      const nextType = targetOrder[path.length];
      if (!nextType) return;

      for (const { to } of adj.get(from) ?? []) {
        const toType = nodeTypes.get(to);
        if (toType === nextType && !seen.has(to)) {
          const newPath = [...path, to];
          const newSeen = new Set(seen);
          newSeen.add(to);
          if (nextType === "property") {
            riskPaths.push(newPath);
          } else {
            findPaths(to, newPath, newSeen, targetOrder);
          }
        }
      }
    }

    for (const hazardKey of reachableHazards) {
      findPaths(hazardKey, [hazardKey], new Set([hazardKey]), [
        "hazard",
        "compliance",
        "asset",
        "space",
        "property",
      ]);
    }

    const riskPathsFormatted = riskPaths.slice(0, 10).map((p) =>
      p.map((k) => {
        const [t, id] = k.split(":");
        return `${t}:${id}`;
      })
    );

    return jsonResponse({
      ok: true,
      centrality: Math.round(centrality * 100) / 100,
      hazardExposure: Math.round(hazardExposure * 100) / 100,
      complianceInfluence,
      taskImpact,
      riskPaths: riskPathsFormatted,
    });
  } catch (err: unknown) {
    console.error("graph-insight error:", err);
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
});
