import { useMemo } from "react";
import { Navigate, useSearchParams, Link } from "react-router-dom";
import { Users, UserPlus } from "lucide-react";
import { LoadingState } from "@/components/design-system/LoadingState";
import { GlobalAppHeader } from "@/components/layout/GlobalAppHeader";
import {
  WorkbenchControlsProvider,
  useWorkbenchControls,
} from "@/contexts/WorkbenchControlsContext";
import {
  PropertyWorkspaceLayout,
  WorkspaceSurfaceCard,
  WorkspaceSectionHeading,
} from "@/components/property-workspace";
import { PropertyActivityTabStrip } from "@/components/property/PropertyActivityTabStrip";
import { ManageTagsPanel } from "@/components/property/ManageTagsPanel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { propertyActivityPeoplePath } from "@/lib/propertyRoutes";
import { FILLA_TURQUOISE } from "@/lib/brandColors";
import { cn } from "@/lib/utils";

function roleLabel(role: string): string {
  const r = role.toLowerCase();
  if (r === "owner") return "Owner";
  if (r === "manager") return "Manager";
  if (r === "staff" || r === "member") return "Staff";
  if (r === "external" || r === "guest") return "External";
  return role;
}

/**
 * Property activity — People. Org members outside Settings; invite deep-links to team settings.
 */
function PropertyPeoplePageInner() {
  const [searchParams] = useSearchParams();
  const propertyFromUrl = searchParams.get("property");
  const { data: properties = [], isLoading: propertiesLoading } = usePropertiesQuery();
  const { orgId, isLoading: orgLoading } = useActiveOrg();
  const { members, loading: membersLoading, error } = useOrgMembers();
  const { searchQuery } = useWorkbenchControls();

  const scopedProperty = useMemo(
    () => properties.find((p) => p.id === propertyFromUrl),
    [properties, propertyFromUrl]
  );

  /** Single-property orgs: sync `?property=` when missing. */
  const resolvedPropertyId = useMemo(() => {
    if (propertyFromUrl && properties.some((p) => p.id === propertyFromUrl)) {
      return propertyFromUrl;
    }
    if (!propertyFromUrl && properties.length === 1 && properties[0]?.id) {
      return properties[0].id;
    }
    return propertyFromUrl;
  }, [propertyFromUrl, properties]);

  const headerAccent =
    (scopedProperty as { icon_color_hex?: string | null } | undefined)?.icon_color_hex?.trim() ||
    FILLA_TURQUOISE;

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const hay = [m.display_name, m.email, m.role, roleLabel(m.role)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [members, searchQuery]);

  const scopedMembers = useMemo(() => {
    if (!resolvedPropertyId) return filteredMembers;
    return filteredMembers.filter((m) => {
      const assigned = m.assigned_properties;
      if (!assigned || assigned.length === 0) return true;
      return assigned.includes(resolvedPropertyId);
    });
  }, [filteredMembers, resolvedPropertyId]);

  if (orgLoading || propertiesLoading) {
    return <LoadingState message="Loading people…" />;
  }

  if (!propertyFromUrl && resolvedPropertyId) {
    return <Navigate to={propertyActivityPeoplePath(resolvedPropertyId)} replace />;
  }

  const header = <GlobalAppHeader accentColor={headerAccent} />;

  const contextColumn = (
    <div className="space-y-4">
      <WorkspaceSurfaceCard title="Overview" description="Who can work on this organisation">
        <ul className="text-xs text-muted-foreground space-y-2">
          <li>
            <span className="font-semibold text-foreground">{members.length}</span> people
          </li>
          {resolvedPropertyId ? (
            <li>
              <span className="font-semibold text-foreground">{scopedMembers.length}</span> visible
              for this property scope
            </li>
          ) : null}
          <li className="text-2xs pt-1">
            Owners and Managers coordinate; Staff perform assigned work. Invite from Settings → Team.
          </li>
        </ul>
      </WorkspaceSurfaceCard>
    </div>
  );

  const workColumn = (
    <div className="space-y-5">
      <PropertyActivityTabStrip activeTab="people" propertyId={resolvedPropertyId} />
      <div>
        <WorkspaceSectionHeading>Team members</WorkspaceSectionHeading>
        {error ? (
          <p className="text-sm text-destructive mt-2">{error}</p>
        ) : membersLoading ? (
          <LoadingState message="Loading members…" />
        ) : scopedMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-3 py-6">
            {searchQuery.trim()
              ? "No people match your search."
              : "No team members yet. Invite someone from Settings → Team."}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {scopedMembers.map((member) => (
              <li
                key={member.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl bg-card/80 px-3 py-2.5 shadow-e1"
                )}
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={member.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {member.display_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground leading-tight truncate">
                    {member.display_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {member.email || `${member.user_id.slice(0, 8)}…`}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0 text-2xs">
                  {member.is_primary_owner ? "Primary Owner" : roleLabel(member.role)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  const actionColumn = (
    <div className="space-y-4">
      <WorkspaceSurfaceCard
        title="Invite member"
        description="Invites are managed in organisation settings for now."
      >
        <Button asChild type="button" className="w-full btn-accent-vibrant gap-2">
          <Link to="/settings/team">
            <UserPlus className="h-4 w-4" />
            Open team settings
          </Link>
        </Button>
      </WorkspaceSurfaceCard>
      <ManageTagsPanel surface="people" />
    </div>
  );

  const workspace = (
    <PropertyWorkspaceLayout
      pageTitle="People"
      pageSubtitle={
        scopedProperty
          ? `${scopedProperty.nickname || scopedProperty.address}`
          : orgId
            ? "Organisation team"
            : "People"
      }
      pageIcon={<Users />}
      contextColumn={contextColumn}
      workColumn={workColumn}
      actionColumn={actionColumn}
    />
  );

  return (
    <div className="dashboard-workbench min-h-screen w-full max-w-full overflow-x-hidden bg-background">
      {header}
      <div className="mx-auto max-w-[1480px] px-gutter-page py-6 w-full">{workspace}</div>
    </div>
  );
}

export default function PropertyPeoplePage() {
  return (
    <WorkbenchControlsProvider defaultPropertyId="all" initialFilters={new Set()}>
      <PropertyPeoplePageInner />
    </WorkbenchControlsProvider>
  );
}
