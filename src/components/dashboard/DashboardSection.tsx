import { ReactNode } from 'react';

interface DashboardSectionProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}

export default function DashboardSection({ title, children, action }: DashboardSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {action && <div>{action}</div>}
      </div>
      {children}
    </section>
  );
}
