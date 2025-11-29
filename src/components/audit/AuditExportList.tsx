import AuditExportOption from './AuditExportOption';
import { Building2, FileText, BarChart3 } from 'lucide-react';

export default function AuditExportList() {
  const options = [
    { 
      title: 'Full Organisation Audit Pack', 
      description: 'Complete compliance report including all rules, versions, clauses, property assignments, and drift analysis.',
      icon: Building2,
      exportType: 'org_full'
    },
    { 
      title: 'Rule Audit Pack', 
      description: 'Detailed audit for a single compliance rule with complete version history, clause changes, and compliance diffs.',
      icon: FileText,
      exportType: 'rule_single'
    },
    { 
      title: 'Property Compliance Pack', 
      description: 'Comprehensive compliance status report for a single property including all applicable rules and drift tracking.',
      icon: BarChart3,
      exportType: 'property_single'
    }
  ];

  return (
    <div className="space-y-4">
      {options.map((option, index) => (
        <AuditExportOption
          key={index}
          title={option.title}
          description={option.description}
          icon={option.icon}
          exportType={option.exportType}
        />
      ))}
    </div>
  );
}
