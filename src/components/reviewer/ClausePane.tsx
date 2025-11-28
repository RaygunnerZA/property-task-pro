import { Surface, Text, Heading, Button } from '@/components/filla';

interface ClausePaneProps {
  clause: any;
  onApprove: () => void;
  onReject: () => void;
}

export function ClausePane({ clause, onApprove, onReject }: ClausePaneProps) {
  if (!clause) {
    return (
      <Surface variant="neomorphic" className="p-8 h-full flex items-center justify-center">
        <Text variant="muted">Select a clause to review</Text>
      </Surface>
    );
  }

  return (
    <Surface variant="neomorphic" className="p-8 h-full flex flex-col">
      <Heading variant="l" className="mb-4">Clause Review</Heading>
      
      <div className="flex-1 mb-6">
        <Text className="mb-4">{clause.text}</Text>
        {clause.critic_notes && (
          <Text variant="muted" className="text-sm">{clause.critic_notes}</Text>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="primary" onClick={onApprove} fullWidth>
          Approve
        </Button>
        <Button variant="danger" onClick={onReject} fullWidth>
          Reject
        </Button>
      </div>
    </Surface>
  );
}
