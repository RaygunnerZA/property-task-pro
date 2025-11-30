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
  Archive
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { NavLink } from '@/components/NavLink';
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
  { title: 'Calendar', url: '/work/calendar', icon: Calendar },
  { title: 'Notes', url: '/work/notes', icon: FileText },
  { title: 'AI Suggestions', url: '/work/ai', icon: Sparkles },
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
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors"
              activeClassName="bg-muted text-primary font-semibold"
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
    <Sidebar className="border-r bg-background">
      <SidebarContent className="px-2 py-6">
        {/* WORK Pillar */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Work
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(workItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* MANAGE Pillar */}
        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Manage
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {renderMenuItems(manageItems)}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* RECORD Pillar */}
        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
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
