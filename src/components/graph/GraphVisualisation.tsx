/**
 * GraphVisualisation — Phase 13A
 * Simple SVG-based graph renderer. Scrollable canvas for mobile.
 * Uses circular layout: start node at center, others in rings by depth.
 */
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { GraphNode, GraphEdge } from "@/hooks/useGraphQuery";
const TYPE_COLORS: Record<string, string> = {
  property: "#8EC9CE",
  space: "#96CEB4",
  asset: "#4ECDC4",
  task: "#45B7D1",
  attachment: "#DDA0DD",
  compliance: "#FFEAA7",
  contractor: "#FF6B6B",
  hazard: "#EB6834",
};

interface GraphVisualisationProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  startNodeId?: string;
  className?: string;
}

export function GraphVisualisation({
  nodes,
  edges,
  startNodeId,
  className,
}: GraphVisualisationProps) {
  const { positions, width, height } = useMemo(() => {
    if (nodes.length === 0) return { positions: new Map<string, { x: number; y: number }>(), width: 400, height: 300 };

    const centerX = 200;
    const centerY = 150;
    const radius = 80;
    const pos = new Map<string, { x: number; y: number }>();

    const startId = startNodeId ?? nodes[0]?.id;
    const start = nodes.find((n) => n.id === startId);
    const others = nodes.filter((n) => n.id !== startId);

    if (start) {
      pos.set(start.id, { x: centerX, y: centerY });
    }

    const angleStep = others.length > 0 ? (2 * Math.PI) / others.length : 0;
    others.forEach((n, i) => {
      const angle = i * angleStep - Math.PI / 2;
      pos.set(n.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      });
    });

    return {
      positions: pos,
      width: 400,
      height: 300,
    };
  }, [nodes, startNodeId]);

  if (nodes.length === 0) {
    return (
      <div className={cn("flex items-center justify-center py-12 text-muted-foreground text-sm", className)}>
        No connected nodes
      </div>
    );
  }

  return (
    <div className={cn("overflow-auto rounded-lg border border-border/50 bg-muted/10", className)}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-full"
      >
        {/* Edges */}
        <g>
          {edges.map((e, i) => {
            const fromPos = positions.get(e.from);
            const toPos = positions.get(e.to);
            if (!fromPos || !toPos) return null;
            return (
              <line
                key={i}
                x1={fromPos.x}
                y1={fromPos.y}
                x2={toPos.x}
                y2={toPos.y}
                stroke="currentColor"
                strokeOpacity={0.3}
                strokeWidth={1}
              />
            );
          })}
        </g>
        {/* Nodes */}
        <g>
          {nodes.map((node) => {
            const p = positions.get(node.id);
            if (!p) return null;
            const color = TYPE_COLORS[node.type] ?? "#8EC9CE";
            const letter = (node.name ?? node.type).charAt(0).toUpperCase();
            return (
              <g key={node.id} transform={`translate(${p.x}, ${p.y})`}>
                <circle r={20} fill={color} opacity={0.9} />
                <text y={6} textAnchor="middle" fill="white" fontWeight="bold" fontSize={14}>
                  {letter}
                </text>
                <text
                  y={28}
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize={10}
                  className="fill-foreground"
                >
                  {(node.name ?? node.type).slice(0, 12)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
