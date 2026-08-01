import { format } from 'date-fns';

interface PropertyComplianceItem {
  property: string;
  version: string | number;
  status: string;
  updated_at: string;
  reason?: string;
}

interface AuditPropertyComplianceProps {
  items?: PropertyComplianceItem[];
  title?: string;
}

const statusColors: Record<string, string> = {
  compliant: 'text-success-foreground',
  non_compliant: 'text-destructive',
  pending: 'text-warning-foreground',
};

export default function AuditPropertyCompliance({ items, title }: AuditPropertyComplianceProps) {
  return (
    <div className="printable-section bg-white p-6 border-b border-border">
      <h3 className="text-lg font-semibold text-foreground mb-4">
        {title ?? 'Property Compliance Status'}
      </h3>
      
      {(!items || items.length === 0) ? (
        <p className="text-sm text-muted-foreground">No compliance data available.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left p-2 font-semibold text-foreground">Property</th>
                <th className="text-left p-2 font-semibold text-foreground">Version</th>
                <th className="text-left p-2 font-semibold text-foreground">Status</th>
                <th className="text-left p-2 font-semibold text-foreground">Updated</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-border">
                  <td className="p-2 text-foreground">{item.property}</td>
                  <td className="p-2 text-muted-foreground">{item.version}</td>
                  <td className={`p-2 font-medium ${statusColors[item.status] ?? 'text-muted-foreground'}`}>
                    {item.status.replace(/_/g, ' ')}
                  </td>
                  <td className="p-2 text-muted-foreground">
                    {format(new Date(item.updated_at), 'PP')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
