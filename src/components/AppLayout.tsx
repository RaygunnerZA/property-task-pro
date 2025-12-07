import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Menu } from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col bg-background">
          {/* Header with sidebar trigger - desktop only */}
          <header className="h-12 border-b border-border/50 bg-background/80 backdrop-blur-sm flex items-center px-4 sticky top-0 z-40 md:hidden">
            <SidebarTrigger className="mr-4">
              <Menu className="h-5 w-5 text-foreground" />
            </SidebarTrigger>
          </header>

          {/* Main content area with paper background */}
          <main className="flex-1 overflow-auto bg-background">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
