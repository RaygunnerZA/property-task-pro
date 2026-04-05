import { ReactNode } from "react";

import { PanelSectionTitle } from "@/components/ui/panel-section-title";

interface DashboardSectionProps {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}

export default function DashboardSection({ title, children, action }: DashboardSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <PanelSectionTitle as="h2" className="mb-0">
          {title}
        </PanelSectionTitle>
        {action && <div>{action}</div>}
      </div>
      {children}
    </section>
  );
}
