interface AuditRuleSectionProps {
  rule?: {
    title?: string;
    description?: string;
    domain?: string;
    obligation_type?: string;
    country?: string;
    status?: string;
  };
}

export default function AuditRuleSection({ rule }: AuditRuleSectionProps) {
  return (
    <div className="printable-section bg-white p-6 border-b border-border">
      <h2 className="text-2xl font-bold text-foreground mb-3">
        {rule?.title ?? 'Rule Title'}
      </h2>
      
      <div className="space-y-2 mb-4">
        {rule?.domain && (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold">Domain:</span> {rule.domain}
          </p>
        )}
        {rule?.obligation_type && (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold">Obligation Type:</span> {rule.obligation_type}
          </p>
        )}
        {rule?.country && (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold">Jurisdiction:</span> {rule.country}
          </p>
        )}
        {rule?.status && (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold">Status:</span> {rule.status}
          </p>
        )}
      </div>

      <p className="text-foreground leading-relaxed">
        {rule?.description ?? 'Rule description here.'}
      </p>
    </div>
  );
}
