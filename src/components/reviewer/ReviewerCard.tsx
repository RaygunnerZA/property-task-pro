import { Surface, Text, Heading } from '@/components/filla';

interface ReviewerCardProps {
  review: any;
  onClick?: () => void;
}

export function ReviewerCard({ review, onClick }: ReviewerCardProps) {
  return (
    <Surface
      variant="neomorphic"
      className="p-6 cursor-pointer hover:shadow-e3 transition-shadow"
      onClick={onClick}
    >
      <Heading variant="m" className="mb-2">Review #{review.id}</Heading>
      <Text variant="muted" className="text-sm">
        Status: {review.status || 'Pending'}
      </Text>
    </Surface>
  );
}
