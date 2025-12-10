import { useState } from 'react';
import { LayoutDashboard, CheckSquare, Calendar, Building2, FolderOpen, Shield, Zap, Lightbulb, Bell, Settings, LogOut, Plus, Package } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import fillaLogo from '@/assets/filla-logo-teal-2.svg';
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

// Main navigation items with + button
const mainNavItems = [{
  title: 'Dashboard',
  url: '/dashboard',
  icon: LayoutDashboard,
  hasAdd: false
}, {
  title: 'Tasks',
  url: '/work/tasks',
  icon: CheckSquare,
  hasAdd: true,
  addAction: 'task'
}, {
  title: 'Schedule',
  url: '/work/schedule',
  icon: Calendar,
  hasAdd: true,
  addAction: 'event'
}, {
  title: 'Properties',
  url: '/manage/properties',
  icon: Building2,
  hasAdd: true,
  addAction: 'property'
}, {
  title: 'Assets',
  url: '/record/documents',
  icon: Package,
  hasAdd: true,
  addAction: 'asset'
}, {
  title: 'Compliance',
  url: '/record/compliance',
  icon: Shield,
  hasAdd: true,
  addAction: 'compliance'
}];

// Intelligence section
const intelligenceItems = [{
  title: 'Automations',
  url: '/work/automations',
  icon: Zap
}, {
  title: 'Insights',
  url: '/insights',
  icon: Lightbulb
}];

// Other section
const otherItems = [{
  title: 'Notifications',
  url: '/notifications',
  icon: Bell
}, {
  title: 'Organisation Settings',
  url: '/manage/settings',
  icon: Settings
}];

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Check if current path includes a property context for Spaces
  const hasPropertyContext = currentPath.includes('/properties/') || currentPath.includes('/property/');
  
  const handleAddClick = (e: React.MouseEvent, action: string) => {
    e.preventDefault();
    e.stopPropagation();
    switch (action) {
      case 'task':
        navigate('/add-task');
        break;
      case 'event':
        navigate('/work/schedule?add=true');
        break;
      case 'property':
        navigate('/manage/properties?add=true');
        break;
      case 'asset':
        navigate('/record/documents?add=true');
        break;
      case 'compliance':
        navigate('/record/compliance?add=true');
        break;
      case 'space':
        navigate('/manage/spaces?add=true');
        break;
    }
  };

  const handleSignOut = () => {
    navigate('/login');
  };

  const renderNavItem = (item: typeof mainNavItems[0], showAdd = false) => (
    <SidebarMenuItem 
      key={item.title} 
      onMouseEnter={() => setHoveredItem(item.title)} 
      onMouseLeave={() => setHoveredItem(null)}
    >
      <SidebarMenuButton asChild className="group relative">
        <NavLink 
          to={item.url} 
          className="flex items-center gap-3 px-3 py-2.5 rounded-[5px] text-sidebar-muted hover:text-sidebar-foreground hover:shadow-engraved transition-all" 
          activeClassName="text-sidebar-foreground shadow-engraved"
        >
          <item.icon className="h-5 w-5 flex-shrink-0" />
          {open && <span className="text-sm font-medium tracking-tight">{item.title}</span>}
          
          {/* Plus button - only show on hover */}
          {open && showAdd && item.hasAdd && (
            <button 
              onClick={e => handleAddClick(e, item.addAction!)} 
              className={cn(
                "absolute right-2 p-1 rounded-[5px] hover:bg-primary/20 text-sidebar-muted hover:text-primary transition-all duration-200",
                hoveredItem === item.title ? "opacity-100" : "opacity-0"
              )}
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar relative overflow-hidden h-screen sticky top-0">
      {/* Noise overlay for texture */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.15] mix-blend-overlay" 
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat'
        }} 
      />
      
      <SidebarContent className="px-3 py-4 relative z-10 bg-sidebar-background">
        {/* Logo & Brand */}
        <div className="px-2 py-6 mb-4">
          <div className="flex items-center gap-3">
            <img src={fillaLogo} alt="Filla" className="h-28 w-auto" />
          </div>
        </div>

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {mainNavItems.map(item => renderNavItem(item, true))}
              
              {/* Spaces - only visible when property is selected */}
              {hasPropertyContext && (
                <SidebarMenuItem 
                  onMouseEnter={() => setHoveredItem('Spaces')} 
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <SidebarMenuButton asChild className="group relative pl-8">
                    <NavLink 
                      to="/manage/spaces" 
                      className="flex items-center gap-3 px-3 py-2.5 rounded-[5px] text-sidebar-muted hover:text-sidebar-foreground hover:shadow-engraved transition-all" 
                      activeClassName="text-sidebar-foreground shadow-engraved"
                    >
                      <FolderOpen className="h-5 w-5 flex-shrink-0" />
                      {open && <span className="text-sm font-medium tracking-tight">Spaces</span>}
                      
                      {open && (
                        <button 
                          onClick={e => handleAddClick(e, 'space')} 
                          className={cn(
                            "absolute right-2 p-1 rounded-[5px] hover:bg-primary/20 text-sidebar-muted hover:text-primary transition-all duration-200",
                            hoveredItem === 'Spaces' ? "opacity-100" : "opacity-0"
                          )}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Intelligence Section */}
        <SidebarGroup className="mt-8">
          <SidebarGroupLabel className="px-3 text-[10px] font-mono uppercase tracking-[0.2em] text-sidebar-muted mb-2">
            Intelligence
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {intelligenceItems.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      className="flex items-center gap-3 px-3 py-2.5 rounded-[5px] text-sidebar-muted hover:text-sidebar-foreground hover:shadow-engraved transition-all" 
                      activeClassName="text-sidebar-foreground shadow-engraved"
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {open && <span className="text-sm font-medium tracking-tight">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Other Section */}
        <SidebarGroup className="mt-8">
          <SidebarGroupLabel className="px-3 text-[10px] font-mono uppercase tracking-[0.2em] text-sidebar-muted mb-2">
            Other
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {otherItems.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink 
                      to={item.url} 
                      className="flex items-center gap-3 px-3 py-2.5 rounded-[5px] text-sidebar-muted hover:text-sidebar-foreground hover:shadow-engraved transition-all" 
                      activeClassName="text-sidebar-foreground shadow-engraved"
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {open && <span className="text-sm font-medium tracking-tight">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              
              {/* Sign Out */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button 
                    onClick={handleSignOut} 
                    className="flex items-center gap-3 px-3 py-2.5 rounded-[5px] text-sidebar-muted hover:text-sidebar-foreground hover:shadow-engraved transition-all w-full"
                  >
                    <LogOut className="h-5 w-5 flex-shrink-0" />
                    {open && <span className="text-sm font-medium tracking-tight">Sign Out</span>}
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
