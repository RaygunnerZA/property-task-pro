import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { HazardBadge } from "./HazardBadge";
import { Badge } from "@/components/ui/badge";
import { useUpdateRecommendationStatus } from "@/hooks/useComplianceRecommendations";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, XCircle, RefreshCw, ListTodo } from "lucide-react";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import type { ComplianceRecommendation } from "@/hooks/useComplianceRecommendations";

interface ComplianceRecommendationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recommendation: ComplianceRecommendation | null;
  documentTitle?: string | null;
  propertyName?: string | null;
  propertyId?: string | null;
  expiryDate?: string | null;
  nextDueDate?: string | null;
  onReanalyse?: () => void;
}

function getRiskConfig(risk: string) {
  switch (risk) {
    case "critical":
      return { color: "text-destructive", icon: AlertTriangle };
    case "high":
      return { color: "text-destructive", icon: AlertTriangle };
    case "medium":
      return { color: "text-amber-600", icon: AlertTriangle };
    default:
      return { color: "text-muted-foreground", icon: ListTodo };
  }
}

export function ComplianceRecommendationDrawer({
  open,
  onOpenChange,
  recommendation,
  documentTitle,
  propertyName,
  propertyId,
  expiryDate,
  nextDueDate,
  onReanalyse,
}: ComplianceRecommendationDrawerProps) {
  const [createTaskPrefill, setCreateTaskPrefill] = useState<{
    title?: string;
    description?: string;
    dueDate?: string;
    propertyId?: string;
    spaceIds?: string[];
    assetIds?: string[];
    category?: string;
  } | null>(null);

  const { mutate: updateStatus, isPending: isUpdating } = useUpdateRecommendationStatus();
  const { toast } = useToast();

  if (!recommendation) return null;

  const riskConfig = getRiskConfig(recommendation.risk_level);
  const RiskIcon = riskConfig.icon;

  const handleAccept = () => {
    updateStatus(
      { id: recommendation.id, status: "accepted" },
      {
        onSuccess: () => {
          toast({ title: "Recommendation accepted" });
          onOpenChange(false);
        },
        onError: (e) => toast({ title: "Could not accept", description: String(e), variant: "destructive" }),
      }
    );
  };

  const handleDismiss = () => {
    updateStatus(
      { id: recommendation.id, status: "dismissed" },
      {
        onSuccess: () => {
          toast({ title: "Recommendation dismissed" });
          onOpenChange(false);
        },
        onError: (e) => toast({ title: "Could not dismiss", description: String(e), variant: "destructive" }),
      }
    );
  };

  const handleCreateTask = (task: (typeof recommendation.recommended_tasks)[0]) => {
    setCreateTaskPrefill({
      title: task.title ?? recommendation.recommended_action,
      description: task.description,
      dueDate: task.dueDate ?? nextDueDate ?? expiryDate ?? undefined,
      propertyId: task.propertyId || propertyId || undefined,
      spaceIds: task.spaceIds,
      assetIds: task.assetIds,
      category: task.category,
    });
  };

  const dueDate = nextDueDate || expiryDate;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <RiskIcon className={cn("h-5 w-5", riskConfig.color)} />
              {documentTitle || recommendation.recommended_action || "Recommendation"}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {/* Summary */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Summary</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("capitalize", riskConfig.color)}>
                    {recommendation.risk_level} risk
                  </Badge>
                </div>
                {recommendation.hazards.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Hazards</div>
                    <div className="flex flex-wrap gap-1">
                      {recommendation.hazards.map((h) => (
                        <HazardBadge key={h} hazard={h} />
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Recommended action</div>
                  <p className="text-sm text-foreground">{recommendation.recommended_action}</p>
                </div>
                {propertyName && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Property</div>
                    <p className="text-sm font-medium">{propertyName}</p>
                  </div>
                )}
                {dueDate && (
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Due / Expiry</div>
                    <p className="text-sm">{format(parseISO(dueDate), "MMM dd, yyyy")}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Suggested tasks */}
            {recommendation.recommended_tasks.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Suggested tasks</h3>
                <div className="space-y-3">
                  {recommendation.recommended_tasks.map((task, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg bg-muted/30 border border-border/50 space-y-2"
                    >
                      <div className="font-medium text-sm">{task.title || "Untitled task"}</div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        onClick={() => handleCreateTask(task)}
                      >
                        <ListTodo className="h-4 w-4 mr-2" />
                        Create task
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2 pt-4 border-t border-border/50">
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={handleAccept}
                  disabled={isUpdating}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Accept
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleDismiss}
                  disabled={isUpdating}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Dismiss
                </Button>
              </div>
              {onReanalyse && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => {
                    onReanalyse();
                    toast({ title: "Re-analysis triggered", description: "Updates may take a moment." });
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Re-run AI interpretation
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <CreateTaskModal
        open={!!createTaskPrefill}
        onOpenChange={(o) => !o && setCreateTaskPrefill(null)}
        onTaskCreated={() => setCreateTaskPrefill(null)}
        prefill={createTaskPrefill ?? undefined}
      />
    </>
  );
}
