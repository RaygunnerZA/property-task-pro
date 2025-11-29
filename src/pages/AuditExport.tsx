import { Heading, Text, SectionHeader } from '@/components/filla';
import AuditExportList from '@/components/audit/AuditExportList';
import { FileBarChart } from 'lucide-react';

export default function AuditExport() {
  return (
    <div className="min-h-screen bg-paper">
      {/* Header */}
      <div className="border-b border-neutral-200 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileBarChart className="w-6 h-6 text-primary" />
            </div>
            <div>
              <Heading variant="xl">Audit Export</Heading>
              <Text variant="body" className="text-neutral-600 mt-1">
                Generate comprehensive audit packs and compliance reports
              </Text>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="space-y-2">
          <SectionHeader title="Export Options" />
          <Text variant="body" className="text-neutral-600">
            Select an export format below. Each pack generates a print-ready PDF with complete audit documentation.
          </Text>
        </div>

        <AuditExportList />

        {/* Info Box */}
        <div className="mt-8 p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <Text variant="label" className="text-primary mb-2 block">
            About Audit Exports
          </Text>
          <Text variant="caption" className="text-neutral-700">
            Audit packs contain timestamped compliance data, version histories, and property status reports. 
            All exports are generated in real-time and include the most current information from your organization's compliance database.
          </Text>
        </div>
      </div>
    </div>
  );
}
