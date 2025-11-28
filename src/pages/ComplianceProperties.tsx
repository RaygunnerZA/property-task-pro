import { Surface, Heading } from '@/components/filla';
import { PropertyComplianceList } from '@/components/compliance/PropertyComplianceList';
import { useRulesCompliance } from '@/hooks/useRulesCompliance';

export default function ComplianceProperties() {
  const { rules, loading } = useRulesCompliance();

  return (
    <div className="min-h-screen bg-paper p-6">
      <div className="max-w-6xl mx-auto">
        <Heading variant="xl" className="mb-6">Organization Compliance</Heading>
        
        <PropertyComplianceList rules={rules} loading={loading} />
      </div>
    </div>
  );
}
