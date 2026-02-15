# Chapter 22 — Graph Insight Layer (Phase 13B)

**Status:** Implemented  
**Phase:** 13B — FILLA Graph Insight Layer  
**Read-only.** No automation, no writes into tasks, no new risks to user data.

---

## 1. Overview

Phase 13A created the structural graph: nodes, edges, and multi-entity connectivity. Phase 13B turns that static graph into **actionable intelligence** by computing semantic metrics and risk paths from graph data only.

All insights are computed client-side or via read-only edge functions. Nothing is persisted to the database.

---

## 2. Objectives

1. **Convert graph data into meaning** — Answer questions such as:
   - Which assets are most exposed to compliance risk?
   - Which spaces have the highest hazard concentration?
   - Which tasks are critical because of their position in the graph?
   - Which compliance failures propagate across multiple assets or spaces?

2. **Provide "Graph Insights" panels** across the app for Properties, Spaces, Assets, Compliance, and Tasks.

3. **Add new insight types without changing the graph schema** — All insights are computed from `property_graph_edges`; no schema changes required.

---

## 3. Graph-Derived Metrics

These metrics are computed from `property_graph_edges` only. They are **not stored** in the database.

### 3.1 Node Centrality Score

- **Formula:** `degree centrality = number of edges touching this node`
- **Normalisation:** `centrality = min(1, degree / max_degree_in_subgraph)`
- **Interpretation:** Higher score → more operational importance (more connections)

### 3.2 Hazard Exposure Score

- **Formula:** `exposure = Σ (hazard_weight / distance)`
- **Where:** For each hazard node reachable from the start node, `distance` is the BFS hop count + 1
- **Used for:** Assets, Spaces, Properties
- **Interpretation:** Higher score → more exposure to hazards (closer or more hazards)

### 3.3 Compliance Influence Score

- **When start node is compliance:** Count of unique assets + spaces reachable within depth 2 (downstream impact)
- **When start node is asset/space/property:** Count of compliance nodes in the subgraph (how many compliance items affect this entity)
- **Interpretation:** Higher score → broader compliance impact

### 3.4 Task Impact Score

- **Formula:** For a task node: `taskImpact = reachable_assets + reachable_compliance + (1 if hazards_in_depth_2 else 0)`
- **For other nodes:** `taskImpact = reachable_compliance + reachable_assets`
- **Interpretation:** Higher score → task touches more assets/compliance; potential hazard proximity increases importance

### 3.5 Risk Paths

A **risk path** is a path connecting:

```
hazard → compliance → asset → space → property
```

- **Computation:** DFS from each hazard in the subgraph, following the type sequence above
- **Storage:** Not stored; computed dynamically per request
- **Limit:** Up to 10 paths returned to avoid UI overload

---

## 4. Edge Function: `graph-insight`

### Input

```json
{
  "org_id": "uuid",
  "start": { "type": "asset|space|property|task|compliance", "id": "uuid" },
  "depth": 1 | 2 | 3
}
```

- `depth` is clamped to 1–3 for performance.

### Output

```json
{
  "ok": true,
  "centrality": 0.34,
  "hazardExposure": 12,
  "complianceInfluence": 4,
  "taskImpact": 2,
  "riskPaths": [
    ["hazard:H1", "compliance:C2", "asset:A3", "space:S4", "property:P5"],
    ...
  ]
}
```

### Implementation Notes

- Uses BFS from `start` to build a subgraph (same logic as `graph-query`)
- All metrics computed in-memory from the subgraph
- No DB writes; no modifications to graph or linked entities
- Must be fast; depth limited to 1–3

---

## 5. Frontend Integration

### 5.1 Hook: `useGraphInsight(startNode)`

**Location:** `src/hooks/useGraphInsight.ts`

**Output:**

```ts
{
  centrality: number;
  hazardExposure: number;
  complianceInfluence: number;
  taskImpact: number;
  riskPaths: string[][];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}
```

### 5.2 Insight Panels

| Location | Component | Variant | Content |
|----------|-----------|---------|---------|
| AssetDetailPanel | GraphInsightPanel | full | Insights tab above Graph tab: hazard exposure badge, compliance influence chips, risk paths list |
| PropertyDetail | GraphInsightPanel | full | Property Insights card: centrality, hazard exposure, compliance influence, task impact, risk paths |
| SpaceDetailPage | GraphInsightPanel | full | Insights tab: same metrics for space |
| ComplianceDetailDrawer | GraphInsightPanel | compact | Graph Impact section: affected assets, hazards via this compliance |
| TaskDetailPanel | GraphInsightPanel | minimal | Graph Importance block: taskImpact score, hazard exposure badge |

### 5.3 Visual Elements

- No new visualisation engines
- Risk paths and scores shown as lists, badges, small meters
- Uses existing design tokens (teal primary, coral accent, neomorphic shadows)

---

## 6. Extending the Insight Layer

To add a new insight type:

1. **Compute in `graph-insight`** — Add the formula using the BFS subgraph (nodes, edges, distances).
2. **Return in the response** — Extend the JSON output.
3. **Update `useGraphInsight`** — Add the new field to the hook return.
4. **Update `GraphInsightPanel`** — Display the new metric in the appropriate variant.

No changes to `property_graph_edges` or `graph-sync` are required.

### Example: Add "Connectivity Clusters" Score

1. In `graph-insight`: After BFS, count how many distinct "clusters" (connected components) touch the start node.
2. Add `connectivityClusters: number` to the response.
3. Add to `useGraphInsight` return.
4. Add a small badge or meter in `GraphInsightPanel` for the new metric.

---

## 7. Constraints

- **Read-only:** No writes to tasks, compliance, assets, hazards, or attachments
- **No behavioural changes:** Task creation, assignment, compliance automation, AI analysis, and graph-sync logic are unchanged
- **Performance:** All calculations run on subgraphs from BFS; depth 1–3; no full-org graph scans
- **UI:** Must not produce noticeable pause; use loading skeletons

---

## 8. File Reference

| File | Purpose |
|------|---------|
| `supabase/functions/graph-insight/index.ts` | Edge function: computes metrics from graph |
| `src/hooks/useGraphInsight.ts` | React Query hook for graph insights |
| `src/components/graph/GraphInsightPanel.tsx` | Reusable insight display (full/compact/minimal) |
