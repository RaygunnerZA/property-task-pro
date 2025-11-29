import { ReactNode } from 'react';
import { SectionHeader } from '@/components/filla';

interface DashboardSectionProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}

export default function DashboardSection({ title, children, action }: DashboardSectionProps) {
  return (
    <section className="space-y-4">
      <SectionHeader 
        title={title}
        action={action}
      />
      {children}
    </section>
  );
}
