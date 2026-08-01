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
    <div className="printable-section bg-white p-6 border-b border-border">
      {title && (
        <h4 className="text-base font-semibold text-foreground mb-3">{title}</h4>
      )}
      
      {(!clauses || clauses.length === 0) ? (
        <p className="text-sm text-muted-foreground">No clauses available.</p>
      ) : (
        <div className="space-y-3">
          {clauses.map((clause, idx) => (
            <div key={idx} className="text-sm text-foreground leading-relaxed">
              <div className="flex gap-3">
                <span className="font-semibold text-muted-foreground shrink-0">
                  {idx + 1}.
                </span>
                <div className="flex-1">
                  <p>{clause.text}</p>
                  {clause.category && (
                    <p className="text-xs text-muted-foreground mt-1">
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
