import { Surface, Heading, Text } from '@/components/filla';

interface RuleDetailHeaderProps {
  rule: any;
}

export default function RuleDetailHeader({ rule }: RuleDetailHeaderProps) {
  return (
    <Surface variant="neomorphic" className="p-6">
      <Heading variant="l">{rule.title ?? rule.obligation_text ?? 'Untitled Rule'}</Heading>
      <Text variant="muted" className="mt-2">
        {rule.description ?? rule.source_quote ?? 'No description provided.'}
      </Text>
      {rule.country && (
        <Text variant="caption" className="mt-3">
          {rule.country} • {rule.domain}
        </Text>
      )}
    </Surface>
  );
}
