import { ReactNode } from 'react';
import { Surface, Heading } from '@/components/filla';

interface MediaSectionProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}

export default function MediaSection({ title, children, action }: MediaSectionProps) {
  return (
    <Surface variant="neomorphic" className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Heading variant="l">{title}</Heading>
        {action}
      </div>
      {children}
    </Surface>
  );
}
