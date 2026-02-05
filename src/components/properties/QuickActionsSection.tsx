import { Button } from "@/components/ui/button";
import { Repeat, FileSearch, FileText, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface QuickActionsSectionProps {
  propertyId: string;
}

/**
 * Quick Actions Section
 * Action buttons for property operations
 * Neomorphic button styling
 */
export function QuickActionsSection({ propertyId }: QuickActionsSectionProps) {
  const navigate = useNavigate();

  const handleCreateRecurringTask = () => {
    // Navigate to create task with property pre-selected
    navigate(`/add-task?propertyId=${propertyId}`);
  };

  const handleRunAudit = () => {
    // TODO: Implement property audit
    console.log("Run property audit", propertyId);
  };

  const handleGenerateReport = () => {
    // TODO: Implement report generation
    console.log("Generate report", propertyId);
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h3>
      <div className="space-y-2">
        <Button
          variant="outline"
          className="w-full justify-start shadow-e1 hover:shadow-e2 transition-shadow"
          onClick={handleCreateRecurringTask}
        >
          <Repeat className="h-4 w-4 mr-2" />
          Create Recurring Task
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start shadow-e1 hover:shadow-e2 transition-shadow"
          onClick={handleRunAudit}
        >
          <FileSearch className="h-4 w-4 mr-2" />
          Run Property Audit
        </Button>
        <Button
          variant="outline"
          className="w-full justify-start shadow-e1 hover:shadow-e2 transition-shadow"
          onClick={handleGenerateReport}
        >
          <FileText className="h-4 w-4 mr-2" />
          Generate Report
        </Button>
      </div>
    </div>
  );
}

