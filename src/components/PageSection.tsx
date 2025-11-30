import { ReactNode } from "react";
import { DS } from "../design-system/DesignSystem";

interface PageSectionProps {
  children: ReactNode;
}

export default function PageSection({ children }: PageSectionProps) {
  return (
    <section
      className="p-4 rounded-[16px] bg-white/60 backdrop-blur-md"
      style={{ boxShadow: DS.shadow.soft }}
    >
      {children}
    </section>
  );
}
