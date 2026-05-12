import { ReactNode, useEffect } from "react";
import { useNavigate, NavLink, Outlet } from "react-router-dom";
import { Building2, Shield } from "lucide-react";
import { useIsPlatformAdmin } from "@/hooks/admin/useIsPlatformAdmin";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface AdminLayoutProps {
  children?: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: isAdmin, isLoading } = useIsPlatformAdmin();

  useEffect(() => {
    if (!isLoading && isAdmin === false) {
      navigate("/", { replace: true });
    }
  }, [isAdmin, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* Admin top bar with teal accent */}
      <header className="border-b-2 border-primary bg-background/90 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-screen-xl mx-auto px-4 h-12 flex items-center gap-3">
          <Shield className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
            Internal
          </span>
          <span className="text-muted-foreground/40 text-xs">·</span>
          <nav className="flex items-center gap-4">
            <NavLink
              to="/admin/orgs"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 text-sm font-medium transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )
              }
            >
              <Building2 className="w-4 h-4" />
              Organisations
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6">
        <ErrorBoundary
          regionTitle="Admin panel"
          onRetryReset={() => {
            void queryClient.invalidateQueries();
          }}
        >
          {children ?? <Outlet />}
        </ErrorBoundary>
      </main>
    </div>
  );
}
