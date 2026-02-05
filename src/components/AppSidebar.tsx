import { useMemo } from 'react';
import { 
  LayoutDashboard, 
  CheckSquare, 
  Building2, 
  Package,
  FolderOpen,
  Shield,
  FileText,
  Users,
  StickyNote,
  Wrench,
  History,
  Camera,
  FileCheck,
  Plus,
  Settings,
  LogOut
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import fillaLogo from '@/assets/filla-logo-teal-2.svg';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

// Global navigation items (always visible)
const globalNavItems = [
  {
    title: 'Dashboard',
    url: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'My Tasks',
    url: '/tasks',
    icon: CheckSquare,
  },
];

// Property context items (from Appendix A: Overview, Spaces, Assets, Tasks, Compliance, Documents, People, Notes)
const propertyContextItems = [
  {
    title: 'Overview',
    icon: Building2,
    getUrl: (id: string) => `/properties/${id}`,
  },
  {
    title: 'Assets',
    icon: Package,
    getUrl: (id: string) => `/properties/${id}`, // Assets shown in overview for now
  },
  {
    title: 'Tasks',
    icon: CheckSquare,
    getUrl: (id: string) => `/properties/${id}/tasks`,
  },
  {
    title: 'Compliance',
    icon: Shield,
    getUrl: (id: string) => `/properties/${id}/compliance`,
  },
  {
    title: 'Documents',
    icon: FileText,
    getUrl: (id: string) => `/properties/${id}/documents`,
  },
  {
    title: 'Spaces',
    icon: FolderOpen,
    getUrl: (id: string) => `/properties/${id}`, // Spaces shown in overview for now
  },
];

// Asset context items (from Appendix A: Overview, Tasks, Maintenance, History, Documents, Photos, Warranty)
const assetContextItems = [
  {
    title: 'Overview',
    icon: Package,
    getUrl: (id: string) => `/assets/${id}`, // Assuming asset detail route exists
  },
  {
    title: 'Tasks',
    icon: CheckSquare,
    getUrl: (id: string) => `/assets/${id}/tasks`,
  },
  {
    title: 'Maintenance',
    icon: Wrench,
    getUrl: (id: string) => `/assets/${id}/maintenance`,
  },
  {
    title: 'History',
    icon: History,
    getUrl: (id: string) => `/assets/${id}/history`,
  },
  {
    title: 'Documents',
    icon: FileText,
    getUrl: (id: string) => `/assets/${id}/documents`,
  },
  {
    title: 'Photos',
    icon: Camera,
    getUrl: (id: string) => `/assets/${id}/photos`,
  },
  {
    title: 'Warranty',
    icon: FileCheck,
    getUrl: (id: string) => `/assets/${id}/warranty`,
  },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  // Detect entity context from URL
  const entityContext = useMemo(() => {
    // Check for property context: /properties/:id or /property/:id
    const propertyMatch = currentPath.match(/^\/(?:properties|property)\/([^/]+)/);
    if (propertyMatch) {
      return {
        type: 'property' as const,
        id: propertyMatch[1],
      };
    }

    // Check for asset context: /assets/:id or /asset/:id
    const assetMatch = currentPath.match(/^\/(?:assets|asset)\/([^/]+)/);
    if (assetMatch) {
      return {
        type: 'asset' as const,
        id: assetMatch[1],
      };
    }

    return null;
  }, [currentPath]);

  // Get context items based on entity type
  const contextItems = useMemo(() => {
    if (!entityContext) return [];
    
    if (entityContext.type === 'property') {
      return propertyContextItems;
    } else if (entityContext.type === 'asset') {
      return assetContextItems;
    }
    
    return [];
  }, [entityContext]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleCreateNew = () => {
    // Trigger FAB - this will be handled by FloatingAddButton
    // For now, navigate to tasks with add param
    navigate('/tasks?add=true');
  };

  const renderNavItem = (
    item: { title: string; url?: string; icon: any; getUrl?: (id: string) => string },
    isContextItem = false,
    entityId?: string
  ) => {
    const url = item.getUrl && entityId ? item.getUrl(entityId) : item.url || '#';
    const isActive = currentPath === url || (isContextItem && currentPath.startsWith(url.split('?')[0]));
    const IconComponent = item.icon;
    
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild className="group relative !bg-transparent hover:!bg-transparent">
          <NavLink 
            to={url} 
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-[5px] bg-transparent",
              isActive
                ? "text-foreground font-semibold"
                : "text-foreground/70"
            )}
            activeClassName=""
            pendingClassName="opacity-50"
          >
            <IconComponent className="h-4 w-4 flex-shrink-0" />
            {open && <span className="text-sm tracking-tight">{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar 
      className="bg-background relative overflow-hidden"
      style={{
        backgroundImage: `url("/textures/white-texture2.jpg")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '50%'
      }}
    >
      <SidebarContent className="px-3 py-4 relative z-10 flex flex-col h-full">
        {/* Logo & Brand */}
        <div className="pl-[16px] pr-2 pt-[15px] pb-0 mb-[15px]">
          <div className="flex items-center gap-3 w-[121px]">
            <img src={fillaLogo} alt="Filla" className="h-28 w-auto" />
          </div>
        </div>

        {/* Global Navigation Layer */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {globalNavItems.map(item => renderNavItem(item))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Context Layer (Dynamic) */}
        {entityContext && contextItems.length > 0 && (
          <SidebarGroup className="mt-8">
            <SidebarGroupLabel className="px-3 text-[10px] font-mono uppercase tracking-[0.2em] text-foreground/50 mb-2">
              {entityContext.type === 'property' ? 'Property' : 'Asset'} Context
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {contextItems.map(item => renderNavItem(item, true, entityContext.id))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Spacer to push action layer to bottom */}
        <div className="flex-1" />

        {/* Action Layer (Bottom) */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {/* Create New Button */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="!bg-transparent hover:!bg-transparent">
                  <button
                    onClick={handleCreateNew}
                    className="flex items-center gap-2 px-3 py-2 rounded-[5px] text-foreground/70 w-full bg-transparent"
                  >
                    <Plus className="h-4 w-4 flex-shrink-0" />
                    {open && <span className="text-sm tracking-tight">Create New</span>}
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Settings */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="!bg-transparent hover:!bg-transparent">
                  <NavLink 
                    to="/settings" 
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-[5px] bg-transparent",
                      currentPath === "/settings" ? "text-foreground font-semibold" : "text-foreground/70"
                    )}
                    activeClassName=""
                    pendingClassName="opacity-50"
                  >
                    <Settings className="h-4 w-4 flex-shrink-0" />
                    {open && <span className="text-sm tracking-tight">Settings</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Sign Out */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="!bg-transparent hover:!bg-transparent">
                  <button 
                    onClick={handleSignOut} 
                    className="flex items-center gap-2 px-3 py-2 rounded-[5px] text-foreground/70 w-full bg-transparent"
                  >
                    <LogOut className="h-4 w-4 flex-shrink-0" />
                    {open && <span className="text-sm tracking-tight">Sign Out</span>}
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
