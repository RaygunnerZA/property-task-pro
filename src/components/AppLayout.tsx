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
      <div className="min-h-screen flex w-full bg-background">
        {/* Sidebar - fixed to left */}
        <AppSidebar />
        
        {/* Main content area */}
        <div className="flex-1 flex flex-col min-h-screen">
          {/* Mobile header with sidebar trigger */}
          <header className="h-12 border-b border-border/50 bg-background/80 backdrop-blur-sm flex items-center px-4 sticky top-0 z-40 md:hidden">
            <SidebarTrigger className="mr-4">
              <Menu className="h-5 w-5 text-foreground" />
            </SidebarTrigger>
          </header>

          {/* Main content with paper background and noise texture */}
          <main className="flex-1 overflow-auto bg-background relative">
            {/* Paper noise texture overlay */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'repeat',
              }}
            />
            {/* Content */}
            <div className="relative z-10">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
