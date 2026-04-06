import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { Loader2, RotateCcw, UserRoundCog, KeyRound, Ban, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSettingsWorkbench } from "@/contexts/SettingsWorkbenchContext";
import { InviteUserForm } from "@/components/invite/InviteUserForm";
import {
  WorkspaceSectionHeading,
  WorkspaceSurfaceCard,
  WorkspaceTabList,
  WorkspaceTabTrigger,
} from "@/components/property-workspace";
import { EXTERNAL_ORG_ROLES, INTERNAL_ORG_ROLES } from "@/lib/orgRoles";

type InvitationStatus = "pending" | "accepted" | "expired" | "cancelled";

interface InvitationRecord {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  status: InvitationStatus;
  created_at: string;
  accepted_at: string | null;
  expires_at: string;
  property_ids: string[] | null;
}

type TeamWorkbenchTab = "members" | "invited" | "roles";

export default function SettingsTeam() {
  const queryClient = useQueryClient();
  const { members, loading, error } = useOrgMembers();
  const { orgId } = useActiveOrg();
  const { setRightPanel } = useSettingsWorkbench();
  const [teamTab, setTeamTab] = useState<TeamWorkbenchTab>("members");
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    if (!orgId) {
      setInvitations([]);
      return;
    }

    setLoadingInvites(true);
    try {
      const { data, error: inviteError } = await supabase
        .from("invitations")
        .select(
          "id, email, first_name, last_name, role, status, created_at, accepted_at, expires_at, property_ids"
        )
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (inviteError) throw inviteError;
      setInvitations((data ?? []) as InvitationRecord[]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load invitations";
      toast.error(msg);
    } finally {
      setLoadingInvites(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  useEffect(() => {
    if (teamTab === "members" || teamTab === "invited") {
      setRightPanel(
        <InviteUserForm
          variant="embedded"
          onEmbeddedSuccess={() => {
            void fetchInvitations();
            void queryClient.invalidateQueries({ queryKey: ["org-members"] });
          }}
        />
      );
    } else if (teamTab === "roles") {
      setRightPanel(
        <WorkspaceSurfaceCard
          title="Roles & permissions"
          description="What each preset can do in Filla today. Fine-grained module toggles will layer on top of these."
          className="bg-card/80"
        >
          <ul className="space-y-2 px-4 pb-4 text-xs text-muted-foreground leading-relaxed">
            <li>
              <span className="font-medium text-foreground">Invite flow</span> — assign a role when you send an
              invitation (right column on Team / Invited users).
            </li>
            <li>
              <span className="font-medium text-foreground">Coming next</span> — custom org roles, per-module
              permissions, and property-scoped overrides from this panel.
            </li>
          </ul>
        </WorkspaceSurfaceCard>
      );
    }
    return () => setRightPanel(null);
  }, [teamTab, setRightPanel, fetchInvitations, queryClient]);

  const runInviteAction = useCallback(
    async (invitationId: string, action: string, newPassword?: string) => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error("You must be logged in");
      }

      const { data, error: invokeError } = await supabase.functions.invoke(
        "manage-invited-users",
        {
          body: {
            action,
            invitation_id: invitationId,
            ...(newPassword ? { new_password: newPassword } : {}),
          },
          headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        }
      );

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
    },
    []
  );

  const statusBadgeVariant = useMemo(
    () =>
      ({
        pending: "secondary",
        accepted: "default",
        expired: "outline",
        cancelled: "outline",
      }) as const,
    []
  );

  const formatName = (invite: InvitationRecord) => {
    const full = `${invite.first_name ?? ""} ${invite.last_name ?? ""}`.trim();
    return full || invite.email;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="shadow-e1">
        <CardContent className="pt-6">
          <p className="text-destructive">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <WorkspaceSectionHeading>Team workspace</WorkspaceSectionHeading>
        <WorkspaceTabList className="mt-2">
          <WorkspaceTabTrigger
            selected={teamTab === "members"}
            onClick={() => setTeamTab("members")}
          >
            Team members
          </WorkspaceTabTrigger>
          <WorkspaceTabTrigger
            selected={teamTab === "invited"}
            onClick={() => setTeamTab("invited")}
          >
            Invited users
          </WorkspaceTabTrigger>
          <WorkspaceTabTrigger
            selected={teamTab === "roles"}
            onClick={() => setTeamTab("roles")}
          >
            Roles & permissions
          </WorkspaceTabTrigger>
        </WorkspaceTabList>
      </div>

      {teamTab === "members" && (
        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base">Team members</CardTitle>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No team members yet. Use <strong>Invite member</strong> on the right to add people.
              </p>
            ) : (
              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {member.display_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">{member.display_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {member.email || `${member.user_id.slice(0, 8)}...`}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        member.role === "owner"
                          ? "default"
                          : member.role === "manager"
                            ? "secondary"
                            : "outline"
                      }
                      className={cn(
                        member.role === "owner" && "bg-primary text-primary-foreground",
                        member.role === "manager" && "bg-secondary text-secondary-foreground"
                      )}
                    >
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {teamTab === "invited" && (
        <Card className="shadow-e1">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Invited users</CardTitle>
            <Button onClick={() => void fetchInvitations()} size="sm" variant="outline">
              <RotateCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {loadingInvites ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : invitations.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No invitations yet. Send one from the <strong>Invite member</strong> panel on the right.
              </p>
            ) : (
              <div className="space-y-3">
                {invitations.map((invite) => {
                  const isBusy = actionBusyId === invite.id;
                  return (
                    <div key={invite.id} className="rounded-lg bg-card p-3 shadow-e1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{formatName(invite)}</p>
                          <p className="text-xs text-muted-foreground">{invite.email}</p>
                          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="capitalize">{invite.role}</span>
                            <span>•</span>
                            <span>
                              {invite.property_ids?.length
                                ? `${invite.property_ids.length} assigned properties`
                                : "All properties"}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            Sent {new Date(invite.created_at).toLocaleString()}
                            {invite.accepted_at
                              ? ` • Accepted ${new Date(invite.accepted_at).toLocaleString()}`
                              : ""}
                          </div>
                        </div>
                        <Badge
                          variant={statusBadgeVariant[invite.status]}
                          className={cn(
                            invite.status === "accepted" && "bg-primary text-primary-foreground"
                          )}
                        >
                          {invite.status}
                        </Badge>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {invite.status !== "accepted" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={async () => {
                              try {
                                setActionBusyId(invite.id);
                                await runInviteAction(invite.id, "resend_invite");
                                toast.success("Invitation resent");
                                await fetchInvitations();
                              } catch (e: unknown) {
                                toast.error(e instanceof Error ? e.message : "Failed to resend invitation");
                              } finally {
                                setActionBusyId(null);
                              }
                            }}
                          >
                            <UserRoundCog className="mr-2 h-4 w-4" />
                            Resend
                          </Button>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isBusy}
                          onClick={async () => {
                            try {
                              setActionBusyId(invite.id);
                              await runInviteAction(invite.id, "send_password_reset");
                              toast.success("Password reset email sent");
                            } catch (e: unknown) {
                              toast.error(e instanceof Error ? e.message : "Failed to send password reset");
                            } finally {
                              setActionBusyId(null);
                            }
                          }}
                        >
                          <KeyRound className="mr-2 h-4 w-4" />
                          Password Reset
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isBusy}
                          onClick={async () => {
                            const password = window.prompt(
                              "Set a temporary password (min 8 characters):"
                            );
                            if (!password) return;
                            if (password.length < 8) {
                              toast.error("Password must be at least 8 characters");
                              return;
                            }
                            try {
                              setActionBusyId(invite.id);
                              await runInviteAction(invite.id, "set_password_manual", password);
                              toast.success("Password set and access granted");
                              await fetchInvitations();
                            } catch (e: unknown) {
                              toast.error(e instanceof Error ? e.message : "Failed to set password");
                            } finally {
                              setActionBusyId(null);
                            }
                          }}
                        >
                          <UserRoundCog className="mr-2 h-4 w-4" />
                          Create/Set Password
                        </Button>

                        {invite.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isBusy}
                            onClick={async () => {
                              try {
                                setActionBusyId(invite.id);
                                await runInviteAction(invite.id, "cancel_invite");
                                toast.success("Invitation cancelled");
                                await fetchInvitations();
                              } catch (e: unknown) {
                                toast.error(e instanceof Error ? e.message : "Failed to cancel invitation");
                              } finally {
                                setActionBusyId(null);
                              }
                            }}
                          >
                            <Ban className="mr-2 h-4 w-4" />
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {teamTab === "roles" && (
        <div className="space-y-6">
          <WorkspaceSurfaceCard title="Internal roles" className="bg-card/80">
            <div className="space-y-3 px-4 pb-4">
              {INTERNAL_ORG_ROLES.map((r) => (
                <div
                  key={r.value}
                  className="rounded-[8px] border border-border/40 bg-background/60 px-3 py-2.5 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="text-sm font-medium text-foreground">{r.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{r.description}</p>
                </div>
              ))}
            </div>
          </WorkspaceSurfaceCard>

          <WorkspaceSurfaceCard title="External roles" className="bg-card/80">
            <div className="space-y-3 px-4 pb-4">
              {EXTERNAL_ORG_ROLES.map((r) => (
                <div
                  key={r.value}
                  className="rounded-[8px] border border-border/40 bg-background/60 px-3 py-2.5 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 shrink-0 text-accent" />
                    <span className="text-sm font-medium text-foreground">{r.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{r.description}</p>
                </div>
              ))}
            </div>
          </WorkspaceSurfaceCard>

          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>User permissions</strong> — advanced overrides (per user, per module) will live here once
            the policy layer ships. Until then, role + property access from invitations define what someone can
            see and do.
          </p>
        </div>
      )}
    </div>
  );
}
