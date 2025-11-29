interface Clause {
  text: string;
  category?: string;
  confidence?: number;
}

interface AuditClauseListProps {
  clauses?: Clause[];
  title?: string;
}

export default function AuditClauseList({ clauses, title }: AuditClauseListProps) {
  return (
    <div className="printable-section bg-white p-6 border-b border-gray-200">
      {title && (
        <h4 className="text-base font-semibold text-gray-900 mb-3">{title}</h4>
      )}
      
      {(!clauses || clauses.length === 0) ? (
        <p className="text-sm text-gray-500">No clauses available.</p>
      ) : (
        <div className="space-y-3">
          {clauses.map((clause, idx) => (
            <div key={idx} className="text-sm text-gray-800 leading-relaxed">
              <div className="flex gap-3">
                <span className="font-semibold text-gray-600 shrink-0">
                  {idx + 1}.
                </span>
                <div className="flex-1">
                  <p>{clause.text}</p>
                  {clause.category && (
                    <p className="text-xs text-gray-500 mt-1">
                      Category: {clause.category}
                      {clause.confidence && ` • Confidence: ${Math.round(clause.confidence * 100)}%`}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
