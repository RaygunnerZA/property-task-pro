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
  compliant: 'text-green-700',
  non_compliant: 'text-red-700',
  pending: 'text-amber-700',
};

export default function AuditPropertyCompliance({ items, title }: AuditPropertyComplianceProps) {
  return (
    <div className="printable-section bg-white p-6 border-b border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {title ?? 'Property Compliance Status'}
      </h3>
      
      {(!items || items.length === 0) ? (
        <p className="text-sm text-gray-500">No compliance data available.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left p-2 font-semibold text-gray-900">Property</th>
                <th className="text-left p-2 font-semibold text-gray-900">Version</th>
                <th className="text-left p-2 font-semibold text-gray-900">Status</th>
                <th className="text-left p-2 font-semibold text-gray-900">Updated</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="p-2 text-gray-800">{item.property}</td>
                  <td className="p-2 text-gray-700">{item.version}</td>
                  <td className={`p-2 font-medium ${statusColors[item.status] ?? 'text-gray-700'}`}>
                    {item.status.replace(/_/g, ' ')}
                  </td>
                  <td className="p-2 text-gray-600">
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
