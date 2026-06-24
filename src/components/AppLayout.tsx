import { ReactNode, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { ThirdColumnProvider } from '@/contexts/ThirdColumnContext';
import { AssistantProvider } from '@/contexts/AssistantContext';
import { isDevBuild } from '@/context/DevModeContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MobileBottomNav } from '@/components/navigation/MobileBottomNav';
import { MobileAppHeader } from '@/components/layout/MobileAppHeader';
import { isMobileHeaderExcludedPath } from '@/lib/mainNavigation';
import { DevToolsOverlays } from '@/components/dev/DevToolsOverlays';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({
  children
}: AppLayoutProps) {
  const queryClient = useQueryClient();
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const isHubHome = isMobileHeaderExcludedPath(pathname);

  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    mainRef.current?.scrollTo(0, 0);
    mainRef.current?.querySelectorAll('[class*="overflow-y-auto"], [class*="overflow-auto"]')
      .forEach(el => el.scrollTo(0, 0));
  }, [pathname]);

  return (
    <ThirdColumnProvider>
      <AssistantProvider>
        <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full max-w-full min-w-0 overflow-x-hidden bg-background relative">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-h-screen min-w-0">
          {!isHubHome && <MobileAppHeader />}

          <main 
            ref={mainRef}
            className="flex-1 overflow-auto overflow-x-hidden relative bg-background w-full max-w-full pb-20 lg:pb-0"
            style={{
              backgroundImage: `url("/textures/white-texture2.jpg")`,
              backgroundRepeat: 'repeat',
              backgroundSize: '50%'
            }}
          >
            <div className="relative z-10 w-full max-w-full">
              <ErrorBoundary
                regionTitle="Main workspace"
                onRetryReset={() => {
                  void queryClient.invalidateQueries();
                }}
              >
                {children}
              </ErrorBoundary>
            </div>
          </main>

          <MobileBottomNav />
        </div>

        {(import.meta.env.DEV || isDevBuild) && (
          <ErrorBoundary regionTitle="Dev tools">
            <DevToolsOverlays />
          </ErrorBoundary>
        )}
      </div>
        </SidebarProvider>
      </AssistantProvider>
    </ThirdColumnProvider>
  );
}
