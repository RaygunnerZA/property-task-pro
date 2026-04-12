import { Plus, FileText, FileUp, Sparkles, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspaceSurfaceCard } from "@/components/property-workspace";
import type { IntakeMode } from "@/types/intake";

type RecordsActionRailProps = {
  propertyId: string | null;
  onOpenIntake?: (mode: IntakeMode) => void;
  onAddComplianceRule?: () => void;
  onUploadClick?: () => void;
  onReanalyse?: () => void;
  reanalyseBusy?: boolean;
};

/**
 * Third-column actions when Records is active — same tactile cards as other property rails.
 */
export function RecordsActionRail({
  propertyId,
  onOpenIntake,
  onAddComplianceRule,
  onUploadClick,
  onReanalyse,
  reanalyseBusy,
}: RecordsActionRailProps) {
  const disabled = !propertyId;

  return (
    <div className="flex flex-col gap-4 pr-2 pl-1 pt-3 min-w-0">
      <WorkspaceSurfaceCard title="Primary" description="Create or attach evidence">
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            className="w-full btn-accent-vibrant justify-center gap-2"
            disabled={disabled}
            onClick={() => onOpenIntake?.("add_record")}
          >
            <FileText className="h-4 w-4" />
            Add Record
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full btn-neomorphic justify-center gap-2"
            disabled={disabled}
            onClick={() => (onUploadClick ? onUploadClick() : onOpenIntake?.("add_record"))}
          >
            <FileUp className="h-4 w-4" />
            Upload Document
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full btn-neomorphic justify-center gap-2"
            disabled={disabled}
            onClick={() => onAddComplianceRule?.()}
          >
            <Plus className="h-4 w-4" />
            Add Compliance Rule
          </Button>
        </div>
      </WorkspaceSurfaceCard>

      <WorkspaceSurfaceCard title="AI & linking" description="Short, useful actions — no extra steps">
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full btn-neomorphic justify-center gap-2"
            disabled={disabled || reanalyseBusy}
            onClick={() => onReanalyse?.()}
          >
            <Sparkles className="h-4 w-4 text-primary" />
            {reanalyseBusy ? "Re-running…" : "Re-run AI extraction"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full btn-neomorphic justify-center gap-2"
            disabled={disabled}
            onClick={() => onOpenIntake?.("add_record")}
          >
            <Link2 className="h-4 w-4" />
            Link to asset / rule
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 leading-snug">
          Filla can suggest type, owner, and expiry after upload — review in the list, then confirm.
        </p>
      </WorkspaceSurfaceCard>
    </div>
  );
}
