import { PropertyComplianceList } from '@/components/compliance/PropertyComplianceList';
import { useRulesCompliance } from '@/hooks/useRulesCompliance';
import { StandardPage } from '@/components/design-system/StandardPage';
import { Building2 } from 'lucide-react';

export default function ComplianceProperties() {
  const { rules, loading } = useRulesCompliance();

  return (
    <StandardPage
      title="Organization Compliance"
      icon={<Building2 className="h-6 w-6" />}
      maxWidth="lg"
    >
      <PropertyComplianceList rules={rules} loading={loading} />
    </StandardPage>
  );
}
