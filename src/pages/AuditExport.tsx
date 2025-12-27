import { Heading, Text, SectionHeader } from '@/components/filla';
import AuditExportList from '@/components/audit/AuditExportList';
import { FileBarChart } from 'lucide-react';

export default function AuditExport() {
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
            Select an export format below. Each pack generates a print-ready PDF with complete audit documentation.
          </p>
        </div>

        <AuditExportList />

        {/* Info Box */}
        <Card className="p-4 bg-primary/5 border-primary/20 shadow-e1">
          <p className="text-primary font-semibold mb-2">About Audit Exports</p>
          <p className="text-sm text-muted-foreground">
            Audit packs contain timestamped compliance data, version histories, and property status reports. 
            All exports are generated in real-time and include the most current information from your organization's compliance database.
          </p>
        </Card>
      </div>
    </StandardPage>
  );
}
