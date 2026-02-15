/**
 * graph-query — Phase 13A FILLA Graph Backbone
 * BFS from start node, returns connected subgraph with optional filters.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GraphQueryInput {
  org_id: string;
  start: { type: string; id: string };
  depth?: number;
  filters?: { hazards?: string[]; expiry_state?: string[] };
}

interface GraphNode {
  id: string;
  type: string;
  name?: string;
  expiry_state?: string;
  [k: string]: unknown;
}

interface GraphEdge {
  from: string;
  to: string;
  relationship: string;
  weight?: number;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "POST only" }, 405);

  let body: GraphQueryInput;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const { org_id: orgId, start, depth = 3, filters = {} } = body;
  if (!orgId || !start?.type || !start?.id) {
    return jsonResponse({ ok: false, error: "org_id and start { type, id } required" }, 400);
  }

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

    const nodeId = (type: string, id: string) => `${type}:${id}`;
    const startKey = nodeId(start.type, start.id);

    const adj = new Map<string, Array<{ to: string; rel: string; weight?: number }>>();
    for (const e of edgeList) {
      const fromKey = nodeId(e.source_type, e.source_id);
      const toKey = nodeId(e.target_type, e.target_id);
      if (!adj.has(fromKey)) adj.set(fromKey, []);
      adj.get(fromKey)!.push({ to: toKey, rel: e.relationship, weight: e.weight });
      if (!adj.has(toKey)) adj.set(toKey, []);
      adj.get(toKey)!.push({ to: fromKey, rel: e.relationship, weight: e.weight });
    }

    const visited = new Set<string>();
    const resultNodes = new Map<string, { type: string; id: string }>();
    const resultEdgesSet = new Set<string>();
    const resultEdges: Array<{ from: string; to: string; relationship: string; weight?: number }> = [];

    const queue: Array<{ key: string; d: number }> = [{ key: startKey, d: 0 }];
    visited.add(startKey);
    const [st, si] = startKey.split(":");
    resultNodes.set(startKey, { type: st, id: si });

    while (queue.length > 0) {
      const { key, d } = queue.shift!();
      if (d >= depth) continue;

      for (const { to, rel, weight } of adj.get(key) ?? []) {
        const [tt, ti] = to.split(":");
        if (!visited.has(to)) {
          visited.add(to);
          resultNodes.set(to, { type: tt, id: ti });
          queue.push({ key: to, d: d + 1 });
        }
        const edgeKey = [key, to].sort().join("|");
        if (!resultEdgesSet.has(edgeKey)) {
          resultEdgesSet.add(edgeKey);
          resultEdges.push({ from: key, to, relationship: rel, weight });
        }
      }
    }

    const entries = [...resultNodes.entries()];
    const nodeTypes = [...new Set(entries.map(([, v]) => v.type))];

    const nodeData = new Map<string, GraphNode>();

    if (nodeTypes.includes("property")) {
      const ids = entries.filter(([, v]) => v.type === "property").map(([, v]) => v.id);
      if (ids.length) {
        const { data } = await supabase.from("properties").select("id, nickname, address").in("id", ids);
        for (const p of data ?? []) {
          nodeData.set(nodeId("property", p.id), {
            id: p.id,
            type: "property",
            name: p.nickname || p.address,
          });
        }
      }
    }
    if (nodeTypes.includes("space")) {
      const ids = entries.filter(([, v]) => v.type === "space").map(([, v]) => v.id);
      if (ids.length) {
        const { data } = await supabase.from("spaces").select("id, name").in("id", ids);
        for (const s of data ?? []) {
          nodeData.set(nodeId("space", s.id), { id: s.id, type: "space", name: s.name });
        }
      }
    }
    if (nodeTypes.includes("asset")) {
      const ids = entries.filter(([, v]) => v.type === "asset").map(([, v]) => v.id);
      if (ids.length) {
        const { data } = await supabase.from("assets").select("id, name, asset_type, serial_number").in("id", ids);
        for (const a of data ?? []) {
          nodeData.set(nodeId("asset", a.id), {
            id: a.id,
            type: "asset",
            name: a.name || a.serial_number || "Asset",
          });
        }
      }
    }
    if (nodeTypes.includes("task")) {
      const ids = entries.filter(([, v]) => v.type === "task").map(([, v]) => v.id);
      if (ids.length) {
        const { data } = await supabase.from("tasks").select("id, title, status, due_date").in("id", ids);
        for (const t of data ?? []) {
          nodeData.set(nodeId("task", t.id), {
            id: t.id,
            type: "task",
            name: t.title,
            status: t.status,
            due_date: t.due_date,
          });
        }
      }
    }
    if (nodeTypes.includes("attachment")) {
      const ids = entries.filter(([, v]) => v.type === "attachment").map(([, v]) => v.id);
      if (ids.length) {
        const { data } = await supabase.from("attachments").select("id, file_type, file_name").in("id", ids);
        for (const a of data ?? []) {
          nodeData.set(nodeId("attachment", a.id), {
            id: a.id,
            type: "attachment",
            name: a.file_name || a.file_type || "Attachment",
          });
        }
      }
    }
    if (nodeTypes.includes("compliance")) {
      const ids = entries.filter(([, v]) => v.type === "compliance").map(([, v]) => v.id);
      if (ids.length) {
        const { data } = await supabase
          .from("compliance_portfolio_view")
          .select("id, title, document_type, expiry_state")
          .in("id", ids)
          .eq("org_id", orgId);
        for (const c of data ?? []) {
          nodeData.set(nodeId("compliance", c.id), {
            id: c.id,
            type: "compliance",
            name: c.title,
            document_type: c.document_type,
            expiry_state: c.expiry_state,
          });
        }
      }
    }
    if (nodeTypes.includes("contractor")) {
      const ids = entries.filter(([, v]) => v.type === "contractor").map(([, v]) => v.id);
      if (ids.length) {
        const { data } = await supabase.from("organisations").select("id, name").in("id", ids);
        for (const o of data ?? []) {
          nodeData.set(nodeId("contractor", o.id), { id: o.id, type: "contractor", name: o.name });
        }
      }
    }
    if (nodeTypes.includes("hazard")) {
      for (const [key, n] of resultNodes) {
        if (n.type === "hazard") {
          const e = edgeList.find((x) => nodeId(x.target_type, x.target_id) === key);
          nodeData.set(key, {
            id: n.id,
            type: "hazard",
            name: e?.metadata?.hazard_type ?? "hazard",
          });
        }
      }
    }

    let nodes = [...resultNodes.keys()].map((key) => {
      const [, id] = key.split(":");
      const d = nodeData.get(key) ?? { id, type: key.split(":")[0], name: key.split(":")[0] };
      return { ...d, id };
    });

    if (filters.hazards?.length) {
      nodes = nodes.filter((n) => n.type !== "hazard" || filters.hazards!.includes(n.name ?? ""));
    }
    if (filters.expiry_state?.length) {
      nodes = nodes.filter(
        (n) => n.type !== "compliance" || filters.expiry_state!.includes(n.expiry_state ?? "")
      );
    }

    const nodeIdSet = new Set(nodes.map((n) => `${n.type}:${n.id}`));
    const edgesFiltered = resultEdges.filter((e) => nodeIdSet.has(e.from) && nodeIdSet.has(e.to));

    return jsonResponse({
      ok: true,
      nodes: nodes.map((n) => ({
        id: n.type === "hazard" ? n.id : n.id,
        type: n.type,
        name: n.name,
        expiry_state: n.expiry_state,
      })),
      edges: edgesFiltered.map((e) => ({
        from: e.from.split(":")[1] ?? e.from,
        to: e.to.split(":")[1] ?? e.to,
        relationship: e.relationship,
        weight: e.weight,
      })),
    });
  } catch (err: unknown) {
    console.error("graph-query error:", err);
    return jsonResponse(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      500
    );
  }
});
