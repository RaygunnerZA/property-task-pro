import { Surface, Heading } from '@/components/filla';

interface VersionHistoryHeaderProps {
  rule: any;
}

export default function VersionHistoryHeader({ rule }: VersionHistoryHeaderProps) {
  return (
    <Surface variant="neomorphic" className="p-4 mb-4">
      <Heading variant="m">Version History: {rule?.title ?? 'Rule'}</Heading>
    </Surface>
  );
}
