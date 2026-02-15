import { useGraphQuery } from "@/hooks/useGraphQuery";
import { cn } from "@/lib/utils";
import { Shield, Building2, Package, User, FolderOpen, Flame } from "lucide-react";

interface ComplianceGraphMiniProps {
  complianceDocumentId: string;
  className?: string;
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  property: Building2,
  space: FolderOpen,
  asset: Package,
  compliance: Shield,
  contractor: User,
  document: Shield,
  hazard: Flame,
};

export function ComplianceGraphMini({ complianceDocumentId, className }: ComplianceGraphMiniProps) {
  const { data: graph, isLoading } = useGraphQuery({
    start: { type: "compliance", id: complianceDocumentId },
    depth: 2,
  });

  if (isLoading || !graph) return null;
  if (graph.nodes.length <= 1) return null;

  return (
    <div className={cn("rounded-lg border border-border/50 p-3 bg-muted/20", className)}>
      <div className="text-xs font-medium text-muted-foreground mb-2">Knowledge Graph</div>
      <div className="flex flex-wrap gap-2">
        {graph.nodes
          .filter((n) => n.type !== "compliance")
          .map((node) => {
            const Icon = TYPE_ICONS[node.type] ?? Shield;
            return (
              <div
                key={node.id}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-card shadow-e1 text-xs"
              >
                <Icon className="h-3 w-3 text-muted-foreground" />
                <span className="truncate max-w-[120px]">{node.name ?? node.type}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
