import { ReactNode, lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import { isDevBuild } from "@/context/DevModeContext";

const DevToolsDropdown = lazy(() => import("@/components/dev/DevToolsDropdown"));

interface PageHeaderProps {
  children: ReactNode;
  className?: string;
}

export function PageHeader({ children, className }: PageHeaderProps) {
  return (
    <header className={cn("page-header relative", className)}>
      {isDevBuild && (
        <div className="hidden md:flex absolute right-4 top-2 z-50">
          <Suspense fallback={null}>
            <DevToolsDropdown />
          </Suspense>
        </div>
      )}
      {children}
    </header>
  );
}

