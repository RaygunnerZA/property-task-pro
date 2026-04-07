import { ReactNode, useRef, useEffect, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Menu } from 'lucide-react';
import { AssistantProvider, useAssistantContext } from '@/contexts/AssistantContext';
import { FillaIcon } from '@/components/filla/FillaIcon';
import { cn } from '@/lib/utils';

function MobileAssistantButton() {
  const { openAssistant } = useAssistantContext();
  return (
    <button
      type="button"
      onClick={() => openAssistant()}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-e1',
        'transition-shadow hover:shadow-e2'
      )}
      aria-label="Open Filla AI"
    >
      <FillaIcon size={16} />
    </button>
  );
}
import { ThirdColumnProvider } from '@/contexts/ThirdColumnContext';
import { isDevBuild } from '@/context/DevModeContext';

const AIDebugPanel = lazy(() => import('@/components/dev/AIDebugPanel'));
const ViewportSimulator = lazy(() => import('@/components/dev/ViewportSimulator'));

interface AppLayoutProps {
  children: ReactNode;
}
export function AppLayout({
  children
}: AppLayoutProps) {
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const isHubHome = pathname === '/' || pathname === '';

  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    mainRef.current?.scrollTo(0, 0);
    // Also reset any overflow-y-auto child containers (e.g. DualPaneLayout columns)
    mainRef.current?.querySelectorAll('[class*="overflow-y-auto"], [class*="overflow-auto"]')
      .forEach(el => el.scrollTo(0, 0));
  }, [pathname]);

  return (
    <ThirdColumnProvider>
      <AssistantProvider>
        <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full max-w-full min-w-0 overflow-x-hidden bg-background relative">
        {/* Sidebar - fixed to left */}
        <AppSidebar />
        
        {/* Main content area */}
        <div className="flex-1 flex flex-col min-h-screen min-w-0">
          {/* Mobile: hub uses workbench row for nav + AI; other routes keep menu + assistant here */}
          {!isHubHome && (
            <header className="sticky top-0 z-40 flex h-12 w-full shrink-0 items-center gap-3 border-b border-border/20 bg-background/90 px-4 shadow-sm backdrop-blur-sm lg:hidden">
              <SidebarTrigger className="shrink-0">
                <Menu className="h-5 w-5 text-foreground" />
              </SidebarTrigger>
              <div className="min-w-0 flex-1" />
              <MobileAssistantButton />
            </header>
          )}

          {/* Main content with paper background and noise texture */}
          <main 
            ref={mainRef}
            className="flex-1 overflow-auto overflow-x-hidden relative bg-background w-full max-w-full pb-16 lg:pb-0"
            style={{
              backgroundImage: `url("/textures/white-texture2.jpg")`,
              backgroundRepeat: 'repeat',
              backgroundSize: '50%'
            }}
          >
            {/* Content */}
            <div className="relative z-10 w-full max-w-full">
              {children}
            </div>
          </main>
        </div>

        {/* Dev-only AI Debug Panel overlay */}
        {import.meta.env.DEV && (
          <Suspense fallback={null}>
            <AIDebugPanel />
          </Suspense>
        )}

        {isDevBuild && (
          <Suspense fallback={null}>
            <ViewportSimulator />
          </Suspense>
        )}
      </div>
        </SidebarProvider>
      </AssistantProvider>
    </ThirdColumnProvider>
  );
}