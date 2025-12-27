import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  children: ReactNode;
  className?: string;
}

export function PageHeader({ children, className }: PageHeaderProps) {
  return (
    <header className={cn("page-header", className)}>
      {children}
    </header>
  );
}

