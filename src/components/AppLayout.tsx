import { ReactNode, useRef, useEffect, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Menu } from 'lucide-react';
import { FillaIcon } from '@/components/filla/FillaIcon';
import { useAssistantContext } from '@/contexts/AssistantContext';
import { cn } from '@/lib/utils';

const DevToolsDropdown = lazy(() => import('@/components/dev/DevToolsDropdown'));
const AIDebugPanel = lazy(() => import('@/components/dev/AIDebugPanel'));

function MobileAssistantButton() {
  const { openAssistant } = useAssistantContext();
  return (
    <button
      onClick={() => openAssistant()}
      className={cn(
        "w-9 h-9 rounded-full bg-card shadow-e1 flex items-center justify-center",
        "hover:shadow-e2 transition-shadow"
      )}
      aria-label="Open Assistant"
    >
      <FillaIcon size={16} />
    </button>
  );
}

interface AppLayoutProps {
  children: ReactNode;
}
export function AppLayout({
  children
}: AppLayoutProps) {
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();

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

  return <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full max-w-full min-w-0 overflow-x-hidden bg-background relative">
        {/* Sidebar - fixed to left */}
        <AppSidebar />
        
        {/* Main content area */}
        <div className="flex-1 flex flex-col min-h-screen min-w-0">
          {/* Mobile header with sidebar trigger + Assistant */}
          <header className="h-12 bg-background flex items-center justify-between px-4 sticky top-0 z-40 md:hidden">
            <SidebarTrigger className="mr-4">
              <Menu className="h-5 w-5 text-foreground" />
            </SidebarTrigger>
            <div className="flex items-center gap-2">
              {import.meta.env.DEV && (
                <Suspense fallback={null}>
                  <DevToolsDropdown />
                </Suspense>
              )}
              <MobileAssistantButton />
            </div>
          </header>

          {/* Main content with paper background and noise texture */}
          <main 
            ref={mainRef}
            className="flex-1 overflow-auto overflow-x-hidden relative bg-background w-full max-w-full pb-16 md:pb-0"
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
      </div>
    </SidebarProvider>;
}