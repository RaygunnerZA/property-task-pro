import { 
  CheckSquare, 
  Calendar, 
  FileText, 
  Sparkles, 
  Building2, 
  Users, 
  Truck, 
  FileStack, 
  Settings,
  FolderOpen,
  Shield,
  History,
  BarChart3,
  Archive,
  LayoutDashboard
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
import fillaLogo from '@/assets/filla-logo-teal.svg';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

const workItems = [
  { title: 'Tasks', url: '/work/tasks', icon: CheckSquare },
  { title: 'Inbox', url: '/work/inbox', icon: FileText },
  { title: 'Schedule', url: '/work/schedule', icon: Calendar },
  { title: 'Automations', url: '/work/automations', icon: Sparkles },
];

const manageItems = [
  { title: 'Properties', url: '/manage/properties', icon: Building2 },
  { title: 'Spaces', url: '/manage/spaces', icon: FolderOpen },
  { title: 'People & Teams', url: '/manage/people', icon: Users },
  { title: 'Vendors', url: '/manage/vendors', icon: Truck },
  { title: 'Templates', url: '/manage/templates', icon: FileStack },
  { title: 'Settings', url: '/manage/settings', icon: Settings },
];

const recordItems = [
  { title: 'Documents', url: '/record/documents', icon: FolderOpen },
  { title: 'Compliance', url: '/record/compliance', icon: Shield },
  { title: 'History', url: '/record/history', icon: History },
  { title: 'Reports', url: '/record/reports', icon: BarChart3 },
  { title: 'Library', url: '/record/library', icon: Archive },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath.startsWith(path);

  const renderMenuItems = (items: typeof workItems) => (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild>
            <NavLink 
              to={item.url} 
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
              activeClassName="bg-sidebar-accent text-sidebar-foreground font-semibold"
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {open && <span className="text-sm">{item.title}</span>}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar">
      <SidebarContent className="px-2 py-4">
        {/* Logo & Brand */}
        <div className="px-3 py-4 mb-4">
          <div className="flex items-center gap-3">
            <img 
              src={fillaLogo} 
              alt="Filla" 
              className="h-8 w-8"
            />
            {open && (
              <span className="text-lg font-bold text-sidebar-foreground tracking-tight">
                Filla
              </span>
            )}
          </div>
        </div>

        {/* Dashboard Link */}
        <SidebarMenu className="mb-4">
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink 
                to="/dashboard" 
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                activeClassName="bg-sidebar-accent text-sidebar-foreground font-semibold"
              >
                <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
                {open && <span className="text-sm">Dashboard</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* WORK Pillar */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs font-bold uppercase tracking-wider text-sidebar-foreground/50 mb-2">
            Work
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(workItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* MANAGE Pillar */}
        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="px-3 text-xs font-bold uppercase tracking-wider text-sidebar-foreground/50 mb-2">
            Manage
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(manageItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* RECORD Pillar */}
        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="px-3 text-xs font-bold uppercase tracking-wider text-sidebar-foreground/50 mb-2">
            Record
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(recordItems)}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
