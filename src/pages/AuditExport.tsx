import { Link } from "react-router-dom";
import { FileBarChart, Lock } from "lucide-react";
import AuditExportList from "@/components/audit/AuditExportList";
import { StandardPage } from "@/components/design-system/StandardPage";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOrgEntitlements } from "@/hooks/useOrgEntitlements";

export default function AuditExport() {
  const { has, loading } = useOrgEntitlements();
  const entitled =
    has("advanced_audit_export_enabled") || has("compliance_enabled");

  if (!loading && !entitled) {
    return (
      <StandardPage
        title="Audit Export"
        subtitle="Advanced audit packs require Business governance or compliance entitlements"
        icon={<Lock className="h-6 w-6" />}
        maxWidth="lg"
      >
        <Card className="p-6 shadow-e1 space-y-3">
          <p className="text-sm text-muted-foreground">
            Compliance audit packs and org-wide audit export are gated by entitlements
            (`advanced_audit_export_enabled` / `compliance_enabled`), not plan names.
          </p>
          <Button type="button" asChild>
            <Link to="/settings/billing">View plans</Link>
          </Button>
        </Card>
      </StandardPage>
    );
  }

  return (
    <StandardPage
      title="Audit Export"
      subtitle="Generate comprehensive audit packs and compliance reports"
      icon={<FileBarChart className="h-6 w-6" />}
      maxWidth="lg"
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Export Options</h2>
          <p className="text-muted-foreground">
            Select an export format below. Each pack generates a print-ready PDF with
            complete audit documentation.
          </p>
        </div>

        <AuditExportList />

        <Card className="p-4 bg-primary/5 border-primary/20 shadow-e1">
          <p className="text-primary font-semibold mb-2">About Audit Exports</p>
          <p className="text-sm text-muted-foreground">
            Audit packs contain timestamped compliance data, version histories, and
            property status reports. Org-wide JSON audit export is available from Settings
            → Billing → Governance on Business.
          </p>
        </Card>
      </div>
    </StandardPage>
  );
}
