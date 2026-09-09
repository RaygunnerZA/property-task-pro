import { ReactNode, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { ThirdColumnProvider } from '@/contexts/ThirdColumnContext';
import { AssistantProvider } from '@/contexts/AssistantContext';
import { AppChromeProvider, useAppChrome } from '@/contexts/AppChromeContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MobileBottomNav } from '@/components/navigation/MobileBottomNav';
import { MobileAppHeader } from '@/components/layout/MobileAppHeader';
import {
  isMobileHeaderExcludedPath,
  isWorkbenchHeaderAboveNavPath,
} from '@/lib/mainNavigation';
import { DevToolsOverlays } from '@/components/dev/DevToolsOverlays';
import { useCanAccessDevTools } from '@/hooks/useCanAccessDevTools';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: ReactNode;
}

function AppLayoutShell({ children }: AppLayoutProps) {
  const queryClient = useQueryClient();
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const chrome = useAppChrome();
  const canAccessDevTools = useCanAccessDevTools();
  const ownsChromeHeader = chrome?.ownsHeader ?? false;
  const isHubHome = isMobileHeaderExcludedPath(pathname);
  const headerAboveNav = isWorkbenchHeaderAboveNavPath(pathname) || ownsChromeHeader;
  const showMobileAppHeader = !isHubHome && !ownsChromeHeader;

  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    const resetScroll = () => {
      window.scrollTo(0, 0);
      const main = mainRef.current;
      if (!main) return;
      main.scrollTop = 0;
      // Nested workbench rails (third column, left column on phone, message threads).
      main
        .querySelectorAll(
          '[class*="overflow-y-auto"], [class*="overflow-auto"], [data-workbench-third-column]'
        )
        .forEach((node) => {
          if (node instanceof HTMLElement) node.scrollTop = 0;
        });
    };

    resetScroll();

    // Records (and similar) mount tall left-rail content after the first paint.
    // Without a follow-up pin, overflow anchoring keeps lower content stable and
    // the page appears to open scrolled halfway down.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      resetScroll();
      raf2 = requestAnimationFrame(resetScroll);
    });
    const t0 = window.setTimeout(resetScroll, 0);
    const t1 = window.setTimeout(resetScroll, 50);
    const t2 = window.setTimeout(resetScroll, 200);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(t0);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [pathname]);

  return (
    <ThirdColumnProvider>
      <AssistantProvider>
        <SidebarProvider defaultOpen={false}>
      <div
        className={cn(
          "min-h-screen flex w-full max-w-full min-w-0 overflow-x-hidden bg-background relative",
          headerAboveNav && "app-shell--workbench-header"
        )}
      >
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-h-screen min-w-0">
          {showMobileAppHeader && <MobileAppHeader />}

          <main 
            ref={mainRef}
            className="flex-1 overflow-auto overflow-x-hidden relative bg-background w-full max-w-full pb-20 md:pb-0 [overflow-anchor:none]"
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

        {canAccessDevTools && (
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

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <AppChromeProvider>
      <AppLayoutShell>{children}</AppLayoutShell>
    </AppChromeProvider>
  );
}
