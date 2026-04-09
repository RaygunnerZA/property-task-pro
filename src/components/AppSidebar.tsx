import { useMemo } from 'react';
import { 
  LayoutDashboard, 
  CheckSquare, 
  Package,
  FolderOpen,
  Shield,
  FileText,
  Wrench,
  History,
  Camera,
  FileCheck,
  Plus,
  Settings,
} from 'lucide-react';
import { FillaIcon } from '@/components/filla/FillaIcon';
import { useLocation, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  propertyHubTasksPath,
  propertySubPath,
  WORKBENCH_PANEL_TAB_QUERY,
  normalizeWorkbenchPanelTab,
} from '@/lib/propertyRoutes';
import fillaLogo from '@/assets/filla-logo.svg';
import fillaLogoTeal2 from '@/assets/filla-logo-teal-2.svg';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { useAssistantContext } from '@/contexts/AssistantContext';
import { APP_VERSION } from '@/config/version';

// Global navigation items (always visible)
const globalNavItems = [
  {
    title: 'Hub',
    url: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'My Tasks',
    url: '/tasks',
    icon: CheckSquare,
  },
];

// Property context — deep links (workbench home is global Hub + scope chips)
const propertyContextItems = [
  {
    title: 'Issues',
    icon: CheckSquare,
    getUrl: (id: string) => propertyHubTasksPath(id),
  },
  {
    title: 'Assets',
    icon: Package,
    getUrl: (id: string) => `/assets?property=${encodeURIComponent(id)}`,
  },
  {
    title: 'Compliance',
    icon: Shield,
    getUrl: (id: string) => propertySubPath(id, 'compliance'),
  },
  {
    title: 'Documents',
    icon: FileText,
    getUrl: (id: string) => propertySubPath(id, 'documents'),
  },
  {
    title: 'Spaces',
    icon: FolderOpen,
    getUrl: (id: string) => propertySubPath(id, 'spaces-organise'),
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
  const { open, isMobile } = useSidebar();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { openAssistant } = useAssistantContext();
  const entityContext = useMemo(() => {
    // Property workbench: /?property=<id> (Today hub scoped to one property)
    if (currentPath === '/' || currentPath === '') {
      const pid = searchParams.get('property');
      if (pid) {
        return { type: 'property' as const, id: pid };
      }
    }
    // Filtered property list: /properties?property=<id>
    if (currentPath === '/properties') {
      const pid = searchParams.get('property');
      if (pid) {
        return { type: 'property' as const, id: pid };
      }
    }
    // Property-scoped assets: /assets?property=<id>
    if (currentPath === '/assets') {
      const pid = searchParams.get('property');
      if (pid) {
        return { type: 'property' as const, id: pid };
      }
    }
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
  }, [currentPath, searchParams]);

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

  /** Hub home (`/?property=`) already has property scope + card in LeftColumn — hide duplicate sidebar nav. */
  const hidePropertyContextSidebar = useMemo(() => {
    if (!entityContext || entityContext.type !== 'property') return false;
    const path = currentPath === '' ? '/' : currentPath;
    const isHubRoot = path === '/';
    return isHubRoot && Boolean(searchParams.get('property'));
  }, [currentPath, searchParams, entityContext]);

  const handleCreateNew = () => {
    // Trigger FAB - this will be handled by FloatingAddButton
    // For now, navigate to tasks with add param
    navigate('/tasks?add=true');
  };

  const navLinkClass = (active: boolean) =>
    cn(
      "flex items-center gap-2 px-3 py-2 rounded-[5px] bg-transparent no-underline",
      isMobile
        ? active
          ? "text-white font-semibold"
          : "text-[#8EC9CE]"
        : active
          ? "text-foreground font-semibold"
          : "text-foreground/70"
    );

  const renderNavItem = (
    item: { title: string; url?: string; icon: any; getUrl?: (id: string) => string },
    isContextItem = false,
    entityId?: string
  ) => {
    const url = item.getUrl && entityId ? item.getUrl(entityId) : item.url || '#';
    const urlBase = url.split('?')[0];
    const hubQuery = url.includes('?') ? new URLSearchParams(url.split('?')[1]) : null;
    const hubPropertyId = hubQuery?.get('property');
    const isDashboardPropertyHub =
      isContextItem && urlBase === '/' && Boolean(hubPropertyId);
    const isPropertyListHub =
      isContextItem && urlBase === '/properties' && Boolean(hubPropertyId);
    const isPropertyAssetsHub =
      isContextItem && urlBase === '/assets' && Boolean(hubPropertyId);
    const isHubNav = Boolean(item.url === '/' && !item.getUrl);
    const livePanelTab = searchParams.get(WORKBENCH_PANEL_TAB_QUERY);
    const isActive = isDashboardPropertyHub
      ? item.title === 'Issues'
        ? currentPath === '/' &&
          searchParams.get('property') === hubPropertyId &&
          normalizeWorkbenchPanelTab(livePanelTab) === 'issues'
        : false
      : isPropertyListHub
        ? currentPath === '/properties' &&
          searchParams.get('property') === hubPropertyId
        : isPropertyAssetsHub
          ? currentPath === '/assets' &&
            searchParams.get('property') === hubPropertyId
        : isHubNav
          ? currentPath === '/' && !searchParams.get('property')
          : currentPath === urlBase ||
            (isContextItem && currentPath.startsWith(urlBase + '/'));
    const IconComponent = item.icon;
    
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild className="group relative !bg-transparent hover:!bg-transparent">
          <Link to={url} className={navLinkClass(isActive)}>
            <IconComponent className="h-4 w-4 flex-shrink-0" />
            {open && <span className="text-sm tracking-tight">{item.title}</span>}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar 
      className={cn("relative overflow-hidden", !isMobile && "bg-background")}
      style={
        isMobile
          ? { background: "hsl(var(--sidebar-background))" }
          : {
              backgroundImage: `url("/textures/white-texture2.jpg")`,
              backgroundRepeat: 'repeat',
              backgroundSize: '50%',
            }
      }
    >
      <SidebarContent
        className={cn(
          "relative z-[60] flex h-full flex-col px-3 py-4 pointer-events-auto",
          isMobile && "text-sidebar-foreground"
        )}
      >
        {/* Logo & Brand */}
        <div className="pl-[11px] pr-0 pt-[9px] pb-0 mb-[15px]">
          <Link
            to="/"
            className="flex w-[121px] items-center gap-3 rounded-md outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Go to hub"
          >
            <img
              src={isMobile ? fillaLogoTeal2 : fillaLogo}
              alt=""
              className="pointer-events-none h-auto w-full"
            />
          </Link>
        </div>

        {/* Global Navigation Layer */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {globalNavItems.map(item => renderNavItem(item))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Context Layer (Dynamic) — omitted on property hub; shown on Assets / Compliance / Documents / Spaces etc. */}
        {entityContext && contextItems.length > 0 && !hidePropertyContextSidebar && (
          <SidebarGroup className="mt-8">
            <SidebarGroupLabel
              className={cn(
                "mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.2em]",
                isMobile ? "text-white/50" : "text-foreground/50"
              )}
            >
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
              {/* Assistant */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="!bg-transparent hover:!bg-transparent">
                  <button
                    type="button"
                    onClick={() => openAssistant(entityContext ? { type: entityContext.type, id: entityContext.id } : undefined)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-[5px] bg-transparent px-3 py-2",
                      isMobile ? "text-[#8EC9CE]" : "text-foreground/70"
                    )}
                  >
                    <FillaIcon size={16} className="flex-shrink-0" />
                    {open && <span className="text-sm tracking-tight">Assistant</span>}
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Create New Button */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="!bg-transparent hover:!bg-transparent">
                  <button
                    type="button"
                    onClick={handleCreateNew}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-[5px] bg-transparent px-3 py-2",
                      isMobile ? "text-[#8EC9CE]" : "text-foreground/70"
                    )}
                  >
                    <Plus className="h-4 w-4 flex-shrink-0" />
                    {open && <span className="text-sm tracking-tight">Create New</span>}
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild className="!bg-transparent hover:!bg-transparent">
                  <Link
                    to="/settings"
                    className={cn(
                      "flex w-full items-center gap-2 rounded-[5px] bg-transparent px-3 py-2 no-underline",
                      navLinkClass(currentPath.startsWith("/settings"))
                    )}
                  >
                    <Settings className="h-4 w-4 shrink-0" />
                    {open && <span className="text-sm tracking-tight">Settings</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Version - only when sidebar expanded */}
              {open && (
                <SidebarMenuItem>
                  <div
                    className={cn(
                      "px-3 py-2 font-mono text-[10px]",
                      isMobile ? "text-white/35" : "text-foreground/40"
                    )}
                  >
                    v{APP_VERSION}
                  </div>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
