import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Menu } from 'lucide-react';
import { FillaIcon } from '@/components/filla/FillaIcon';
import { useAssistantContext } from '@/contexts/AssistantContext';
import { cn } from '@/lib/utils';

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
  return <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen flex w-full max-w-full min-w-0 overflow-x-hidden bg-background relative">
        {/* Sidebar - fixed to left */}
        <AppSidebar />
        
        {/* Main content area */}
        <div className="flex-1 flex flex-col min-h-screen min-w-0">
          {/* Mobile header with sidebar trigger + Assistant */}
          <header className="h-12 border-b border-border/50 bg-background/80 backdrop-blur-sm flex items-center justify-between px-4 sticky top-0 z-40 md:hidden">
            <SidebarTrigger className="mr-4">
              <Menu className="h-5 w-5 text-foreground" />
            </SidebarTrigger>
            <MobileAssistantButton />
          </header>

          {/* Main content with paper background and noise texture */}
          <main 
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
      </div>
    </SidebarProvider>;
}