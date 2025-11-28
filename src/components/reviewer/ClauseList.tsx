import { Surface, Text } from '@/components/filla';

interface ClauseListProps {
  clauses: any[];
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function ClauseList({ clauses, selectedId, onSelect }: ClauseListProps) {
  return (
    <div className="flex flex-col gap-2 h-full overflow-y-auto">
      {clauses.map((clause) => (
        <Surface
          key={clause.id}
          variant="neomorphic"
          className={`p-4 cursor-pointer transition-all ${
            selectedId === clause.id ? 'ring-2 ring-primary' : ''
          }`}
          onClick={() => onSelect(clause.id)}
        >
          <Text className="text-sm line-clamp-3">{clause.text}</Text>
        </Surface>
      ))}
    </div>
  );
}
