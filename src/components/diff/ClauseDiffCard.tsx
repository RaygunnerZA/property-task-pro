import { Surface, Text, Heading } from '@/components/filla';

interface ClauseDiffCardProps {
  oldClause?: any;
  newClause?: any;
}

export default function ClauseDiffCard({ oldClause, newClause }: ClauseDiffCardProps) {
  return (
    <Surface variant="neomorphic" className="p-4 mb-3">
      <Heading variant="m" className="mb-3">Clause Diff</Heading>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Text variant="caption" className="mb-2">Old</Text>
          <Surface variant="engraved" className="p-3">
            <Text variant="body">{oldClause?.text ?? '—'}</Text>
          </Surface>
        </div>
        <div>
          <Text variant="caption" className="mb-2">New</Text>
          <Surface variant="engraved" className="p-3">
            <Text variant="body">{newClause?.text ?? '—'}</Text>
          </Surface>
        </div>
      </div>
    </Surface>
  );
}
