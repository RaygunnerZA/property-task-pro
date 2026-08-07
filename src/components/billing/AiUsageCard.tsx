import { Sparkles, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAiQuota } from "@/hooks/useAiQuota";
import { cn } from "@/lib/utils";

type Props = {
  onBuyAiPack: () => void;
  busy?: boolean;
};

export function AiUsageCard({ onBuyAiPack, busy }: Props) {
  const {
    used,
    allowance,
    warning,
    packUnits,
    messagingUsed,
    messagingAllowance,
    usageRatio,
    messagingEnabled,
  } = useAiQuota();

  const pct = Math.min(usageRatio * 100, 100);

  return (
    <Card className="shadow-e1">
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>AI & messaging</CardTitle>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={onBuyAiPack}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Add {packUnits} AI ops
          </Button>
        </div>
        <CardDescription>
          Automated analysis uses AI ops. When allowance runs out, create tasks, complete
          checklists, and upload evidence manually — existing AI results stay available.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">AI ops (this period)</span>
            <span className="text-muted-foreground">
              {used} / {allowance}
            </span>
          </div>
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300",
                pct >= 100
                  ? "bg-destructive"
                  : pct >= 85
                    ? "bg-warning"
                    : "bg-primary"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          {warning && (
            <p
              className={cn(
                "text-xs",
                pct >= 100 ? "text-destructive" : "text-warning-foreground"
              )}
            >
              {warning}
            </p>
          )}
        </div>

        <div className="flex items-start gap-2 text-sm">
          <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-foreground">Premium messaging</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {messagingEnabled
                ? `SMS / WhatsApp: ${messagingUsed} / ${messagingAllowance} units this period. In-app chat is unlimited.`
                : "SMS / WhatsApp not included on this plan. In-app messaging stays available at no extra cost."}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
