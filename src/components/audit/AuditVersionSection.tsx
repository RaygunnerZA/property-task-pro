import { format } from 'date-fns';

interface AuditVersionSectionProps {
  version?: {
    version_number?: number;
    approved_at?: string;
    approved_by?: string;
    clause_count?: number;
  };
}

export default function AuditVersionSection({ version }: AuditVersionSectionProps) {
  return (
    <div className="printable-section bg-white p-6 border-b border-border">
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Version {version?.version_number ?? '—'}
      </h3>
      
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>
          <span className="font-semibold">Approved:</span>{' '}
          {version?.approved_at 
            ? format(new Date(version.approved_at), 'PPP')
            : '—'}
        </p>
        {version?.approved_by && (
          <p>
            <span className="font-semibold">Approved By:</span> {version.approved_by}
          </p>
        )}
        {version?.clause_count !== undefined && (
          <p>
            <span className="font-semibold">Clauses:</span> {version.clause_count}
          </p>
        )}
      </div>
    </div>
  );
}
