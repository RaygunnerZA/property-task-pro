import { useMemo } from "react";
import {
  Package,
  FileText,
  Wrench,
  History,
  Camera,
  FileCheck,
  Plus,
  CheckSquare,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { FillaIcon } from "@/components/filla/FillaIcon";
import { useLocation, useNavigate, useSearchParams, Link } from "react-router-dom";
import {
  MAIN_NAV_ENTRIES,
  PROPERTY_SPACES_PATH,
  isMainNavActive,
  type MainNavItem,
} from "@/lib/mainNavigation";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useIsPlatformAdmin } from "@/hooks/admin/useIsPlatformAdmin";
import { useCanAccessDevTools } from "@/hooks/useCanAccessDevTools";
import { DevToolsDropdown } from "@/components/dev/DevToolsDropdown";
import fillaLogo from "@/assets/filla-logo.svg";
import fillaLogoTeal2 from "@/assets/filla-logo-teal-2.svg";
import fillaDarkLogo from "@/assets/filla-dark.png";
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
} from "@/components/ui/sidebar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { useAssistantContext } from "@/contexts/AssistantContext";
import { APP_VERSION } from "@/config/version";

/** Asset context items (Appendix A: Overview, Tasks, Maintenance, History, Documents, Photos, Warranty) */
const assetContextItems = [
  {
    title: "Overview",
    icon: Package,
    getUrl: (id: string) => `/property/assets?assetId=${encodeURIComponent(id)}`,
  },
  {
    title: "Tasks",
    icon: CheckSquare,
    getUrl: (id: string) => `/property/assets?assetId=${encodeURIComponent(id)}`,
  },
  {
    title: "Maintenance",
    icon: Wrench,
    getUrl: (id: string) => `/property/assets?assetId=${encodeURIComponent(id)}`,
  },
  {
    title: "History",
    icon: History,
    getUrl: (id: string) => `/property/assets?assetId=${encodeURIComponent(id)}`,
  },
  {
    title: "Documents",
    icon: FileText,
    getUrl: (id: string) => `/property/assets?assetId=${encodeURIComponent(id)}`,
  },
  {
    title: "Photos",
    icon: Camera,
    getUrl: (id: string) => `/property/assets?assetId=${encodeURIComponent(id)}`,
  },
  {
    title: "Warranty",
    icon: FileCheck,
    getUrl: (id: string) => `/property/assets?assetId=${encodeURIComponent(id)}`,
  },
];

function withScopedProperty(url: string, property: string | null): string {
  if (!property) return url;
  const [path, qs] = url.split("?");
  if (
    path === "/property" ||
    path.startsWith("/property/") ||
    path === "/spaces" ||
    path === "/assets" ||
    path === "/records" ||
    path === "/tasks" ||
    path === "/calendar" ||
    path === "/home" ||
    path === "/agenda" ||
    path === "/"
  ) {
    const params = new URLSearchParams(qs || "");
    params.set("property", property);
    const next = params.toString();
    return next ? `${path}?${next}` : path;
  }
  return url;
}

export function AppSidebar() {
  const { open, isMobile } = useSidebar();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { openAssistant } = useAssistantContext();
  const { data: properties = [] } = usePropertiesQuery();
  const { data: isPlatformAdmin } = useIsPlatformAdmin();
  const canAccessDevTools = useCanAccessDevTools();
  const isMultiProperty = properties.length > 1;
  const scopedProperty = searchParams.get("property");

  const mainNavEntries = useMemo(() => {
    return MAIN_NAV_ENTRIES.map((entry) => {
      if (entry.type === "separator") return entry;
      return {
        type: "item" as const,
        item: {
          ...entry.item,
          url: withScopedProperty(entry.item.url, scopedProperty),
        },
      };
    });
  }, [scopedProperty]);

  const entityContext = useMemo(() => {
    const assetMatch = currentPath.match(/^\/(?:assets|asset)\/([^/]+)/);
    if (assetMatch) {
      return {
        type: "asset" as const,
        id: assetMatch[1],
      };
    }
    if (currentPath.startsWith("/property/assets")) {
      const assetId = searchParams.get("assetId");
      if (assetId) {
        return { type: "asset" as const, id: assetId };
      }
    }
    return null;
  }, [currentPath, searchParams]);

  const contextItems = useMemo(() => {
    if (!entityContext) return [];
    if (entityContext.type === "asset") return assetContextItems;
    return [];
  }, [entityContext]);

  const handleCreateNew = () => {
    const params = new URLSearchParams(searchParams);
    params.set("add", "true");
    const path = currentPath === "" ? "/" : currentPath;
    const workbenchPaths = new Set([
      "/",
      "/home",
      "/tasks",
      "/calendar",
      "/records",
      "/agenda",
    ]);
    if (workbenchPaths.has(path)) {
      navigate(`${path}?${params.toString()}`);
      return;
    }
    const property = searchParams.get("property");
    const q = new URLSearchParams({ add: "true" });
    if (property) q.set("property", property);
    navigate(`/tasks?${q.toString()}`);
  };

  const navLinkClass = (active: boolean) =>
    cn(
      "flex items-center rounded-sharp bg-transparent no-underline transition-[gap,padding] duration-200 ease-out",
      open ? "gap-2 px-3 py-2" : "justify-center gap-0 px-0 py-2.5",
      isMobile
        ? active
          ? "text-white font-semibold"
          : "text-primary"
        : active
          ? "text-foreground font-semibold"
          : "text-foreground/70"
    );

  const iconClass = cn(
    "flex-shrink-0 transition-[width,height] duration-200 ease-out",
    open ? "h-4 w-4" : "h-5 w-5"
  );

  const renderNavIcon = (item: Pick<MainNavItem, "icon" | "iconSrc" | "title">) => {
    if (item.iconSrc) {
      return (
        <img
          src={item.iconSrc}
          alt=""
          className={cn(iconClass, "object-contain")}
          aria-hidden
        />
      );
    }
    const IconComponent = item.icon as LucideIcon;
    return <IconComponent className={iconClass} />;
  };

  const propertySpacesUrl = (propertyId: string) => {
    const params = new URLSearchParams();
    params.set("property", propertyId);
    return `${PROPERTY_SPACES_PATH}?${params.toString()}`;
  };

  const renderPropertyNavItem = (item: MainNavItem) => {
    const isActive = isMainNavActive(currentPath, item.url, location.search);
    const link = (
      <Link to={item.url} className={navLinkClass(isActive)} aria-label={item.title}>
        {renderNavIcon(item)}
        <span
          className={cn(
            "whitespace-nowrap text-sm font-medium tracking-[-0.2px] transition-[opacity,max-width] duration-200 ease-out",
            open ? "max-w-[9rem] opacity-100" : "max-w-0 overflow-hidden opacity-0"
          )}
        >
          {item.title}
        </span>
      </Link>
    );

    if (!isMultiProperty || isMobile) {
      return (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton
            asChild
            tooltip={isMobile ? undefined : item.title}
            className="group relative !bg-transparent hover:!bg-transparent"
          >
            {link}
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }

    return (
      <SidebarMenuItem key={item.title}>
        <HoverCard openDelay={120} closeDelay={180}>
          <HoverCardTrigger asChild>
            <SidebarMenuButton
              asChild
              tooltip={undefined}
              className="group relative !bg-transparent hover:!bg-transparent"
            >
              {link}
            </SidebarMenuButton>
          </HoverCardTrigger>
          <HoverCardContent
            side="right"
            align="start"
            sideOffset={10}
            className="w-56 border-0 bg-card p-2 shadow-e3"
          >
            <p className="mb-1.5 px-2 font-mono text-2xs uppercase tracking-[0.18em] text-muted-foreground/70">
              Properties
            </p>
            <ul className="max-h-72 space-y-0.5 overflow-y-auto">
              {properties.map((property) => (
                <li key={property.id}>
                  <Link
                    to={propertySpacesUrl(property.id)}
                    className={cn(
                      "block rounded-lg px-2 py-1.5 text-sm text-foreground/80 no-underline transition-colors hover:bg-muted/50 hover:text-foreground",
                      scopedProperty === property.id &&
                        "bg-muted/40 font-semibold text-foreground"
                    )}
                  >
                    {property.nickname || property.address || "Untitled property"}
                  </Link>
                </li>
              ))}
            </ul>
          </HoverCardContent>
        </HoverCard>
      </SidebarMenuItem>
    );
  };

  const renderNavItem = (
    item: {
      title: string;
      url?: string;
      icon: LucideIcon;
      iconSrc?: string;
      expandPropertiesOnHover?: boolean;
      getUrl?: (id: string) => string;
    },
    isContextItem = false,
    entityId?: string
  ) => {
    if (item.expandPropertiesOnHover) {
      return renderPropertyNavItem(item as MainNavItem);
    }

    const url = item.getUrl && entityId ? item.getUrl(entityId) : item.url || "#";
    const urlBase = url.split("?")[0];
    const search = location.search;

    const isActive = isContextItem
      ? currentPath === urlBase || currentPath.startsWith(urlBase + "/")
      : isMainNavActive(currentPath, url, search);

    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton
          asChild
          tooltip={isMobile ? undefined : item.title}
          className="group relative !bg-transparent hover:!bg-transparent"
        >
          <Link to={url} className={navLinkClass(isActive)} aria-label={item.title}>
            {renderNavIcon(item)}
            <span
              className={cn(
                "whitespace-nowrap text-sm font-medium tracking-[-0.2px] transition-[opacity,max-width] duration-200 ease-out",
                open ? "max-w-[9rem] opacity-100" : "max-w-0 overflow-hidden opacity-0"
              )}
            >
              {item.title}
            </span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar
      collapsible={isMobile ? "offcanvas" : "icon"}
      className={cn("relative overflow-hidden", !isMobile && "bg-background")}
      style={
        isMobile
          ? { background: "hsl(var(--sidebar-background))" }
          : {
              backgroundImage: `url("/textures/white-texture2.jpg")`,
              backgroundRepeat: "repeat",
              backgroundSize: "50%",
            }
      }
    >
      <SidebarContent
        className={cn(
          "relative z-[60] flex h-full flex-col py-4 pointer-events-auto",
          open ? "px-3" : "px-1.5",
          isMobile && "text-sidebar-foreground"
        )}
      >
        <div
          className={cn(
            "mb-[15px] pt-[9px] pb-0 transition-[padding] duration-200 ease-out lg:hidden",
            open ? "pl-[11px] pr-0" : "flex justify-center px-0"
          )}
        >
          <Link
            to="/"
            className={cn(
              "flex items-center gap-3 rounded-md outline-none ring-offset-2 ring-offset-background focus-visible:ring-2 focus-visible:ring-primary/40",
              open ? "w-[121px]" : "h-8 w-8 justify-center overflow-hidden"
            )}
            aria-label="Go to home"
          >
            {open || isMobile ? (
              <img
                src={isMobile ? fillaLogoTeal2 : fillaLogo}
                alt=""
                className="pointer-events-none h-auto w-full"
              />
            ) : (
              <img
                src={fillaDarkLogo}
                alt=""
                className="pointer-events-none h-7 w-auto max-w-full object-contain object-left"
              />
            )}
          </Link>
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {mainNavEntries.map((entry, index) => {
                if (entry.type === "separator") {
                  return (
                    <SidebarMenuItem key={`sep-${index}`} className="pointer-events-none list-none">
                      <div
                        className={cn(
                          "my-2 h-px w-full bg-foreground/10",
                          open ? "mx-1" : "mx-auto w-6"
                        )}
                        aria-hidden
                      />
                    </SidebarMenuItem>
                  );
                }
                return renderNavItem(entry.item);
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {entityContext && contextItems.length > 0 && (
          <SidebarGroup className="mt-8">
            {open && (
              <SidebarGroupLabel
                className={cn(
                  "mb-2 px-3 font-mono text-2xs uppercase tracking-[0.2em]",
                  isMobile ? "text-white/50" : "text-foreground/50"
                )}
              >
                Asset Context
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {contextItems.map((item) => renderNavItem(item, true, entityContext.id))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <div className="flex-1" />

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              <SidebarMenuItem>
                <SidebarMenuButton asChild className="!bg-transparent hover:!bg-transparent">
                  <button
                    type="button"
                    onClick={() =>
                      openAssistant(
                        entityContext
                          ? { type: entityContext.type, id: entityContext.id }
                          : undefined
                      )
                    }
                    className={cn(
                      navLinkClass(false),
                      "w-full",
                      isMobile ? "text-primary" : "text-foreground/70"
                    )}
                    aria-label="Assistant"
                  >
                    <FillaIcon size={open ? 16 : 20} className="flex-shrink-0" />
                    <span
                      className={cn(
                        "whitespace-nowrap text-sm tracking-tight transition-[opacity,max-width] duration-200 ease-out",
                        open ? "max-w-[9rem] opacity-100" : "max-w-0 overflow-hidden opacity-0"
                      )}
                    >
                      Assistant
                    </span>
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild className="!bg-transparent hover:!bg-transparent">
                  <button
                    type="button"
                    onClick={handleCreateNew}
                    className={cn(
                      navLinkClass(false),
                      "w-full",
                      isMobile ? "text-primary" : "text-foreground/70"
                    )}
                    aria-label="Create New"
                  >
                    <Plus className={iconClass} />
                    <span
                      className={cn(
                        "whitespace-nowrap text-sm tracking-tight transition-[opacity,max-width] duration-200 ease-out",
                        open ? "max-w-[9rem] opacity-100" : "max-w-0 overflow-hidden opacity-0"
                      )}
                    >
                      Create New
                    </span>
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {isPlatformAdmin === true && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild className="!bg-transparent hover:!bg-transparent">
                    <Link
                      to="/admin/knowledge"
                      className={cn(
                        "no-underline",
                        navLinkClass(currentPath.startsWith("/admin/knowledge"))
                      )}
                      aria-label="Knowledge admin"
                    >
                      <BookOpen className={cn(iconClass, "shrink-0")} />
                      <span
                        className={cn(
                          "whitespace-nowrap text-sm tracking-tight transition-[opacity,max-width] duration-200 ease-out",
                          open ? "max-w-[11rem] opacity-100" : "max-w-0 overflow-hidden opacity-0"
                        )}
                      >
                        Knowledge admin
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {canAccessDevTools ? (
                <SidebarMenuItem>
                  <div className={cn("relative w-full", !open && "flex justify-center")}>
                    <DevToolsDropdown variant="sidebar" sidebarExpanded={open} />
                  </div>
                </SidebarMenuItem>
              ) : null}

              {open && (
                <SidebarMenuItem>
                  <div
                    className={cn(
                      "px-3 py-2 font-mono text-2xs",
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
