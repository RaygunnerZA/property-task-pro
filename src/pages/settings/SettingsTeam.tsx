import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { Loader2, RotateCcw, UserPlus, UserRoundCog, KeyRound, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { InviteUserModal } from "@/components/invite/InviteUserModal";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export default function SettingsTeam() {
  const { members, loading, error } = useOrgMembers();
  const { orgId } = useActiveOrg();
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
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
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load invitations");
    } finally {
      setLoadingInvites(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const runInviteAction = useCallback(
    async (invitationId: string, action: string, newPassword?: string) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d316ba9e-0be2-4ce9-a7ae-7380d7b3193b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'02a203'},body:JSON.stringify({sessionId:'02a203',runId:'pre-fix',hypothesisId:'H2',location:'src/pages/settings/SettingsTeam.tsx:runInviteAction:start',message:'Invite action started',data:{action,invitationId,hasNewPassword:Boolean(newPassword)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d316ba9e-0be2-4ce9-a7ae-7380d7b3193b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'02a203'},body:JSON.stringify({sessionId:'02a203',runId:'pre-fix',hypothesisId:'H2',location:'src/pages/settings/SettingsTeam.tsx:runInviteAction:session',message:'Session lookup completed',data:{hasSession:Boolean(sessionData?.session),sessionError:sessionError?.message ?? null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (sessionError || !sessionData.session) {
        throw new Error("You must be logged in");
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d316ba9e-0be2-4ce9-a7ae-7380d7b3193b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'02a203'},body:JSON.stringify({sessionId:'02a203',runId:'pre-fix',hypothesisId:'H1',location:'src/pages/settings/SettingsTeam.tsx:runInviteAction:beforeInvoke',message:'Invoking manage-invited-users edge function',data:{action,invitationId,hasAuthorizationHeader:Boolean(sessionData.session.access_token)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/d316ba9e-0be2-4ce9-a7ae-7380d7b3193b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'02a203'},body:JSON.stringify({sessionId:'02a203',runId:'pre-fix',hypothesisId:'H1',location:'src/pages/settings/SettingsTeam.tsx:runInviteAction:afterInvoke',message:'Edge function invocation completed',data:{action,invitationId,invokeError:invokeError?.message ?? null,dataError:data?.error ?? null,hasData:Boolean(data)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
    },
    []
  );

  const statusBadgeVariant = useMemo(
    () => ({
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
    <>
      <div className="space-y-4">
        <Card className="shadow-e1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Team Members</CardTitle>
            <Button onClick={() => setInviteModalOpen(true)} size="sm">
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4">
                No team members yet. Invite someone to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-card border border-border"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {member.display_name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">
                          {member.display_name}
                        </p>
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

        <Card className="shadow-e1">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Invited Users</CardTitle>
            <Button onClick={fetchInvitations} size="sm" variant="outline">
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
              <p className="text-muted-foreground text-sm py-4">
                No invitations yet.
              </p>
            ) : (
              <div className="space-y-3">
                {invitations.map((invite) => {
                  const isBusy = actionBusyId === invite.id;
                  return (
                    <div
                      key={invite.id}
                      className="rounded-lg bg-card p-3 shadow-e1"
                    >
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
                            {invite.accepted_at ? ` • Accepted ${new Date(invite.accepted_at).toLocaleString()}` : ""}
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
                                // #region agent log
                                fetch('http://127.0.0.1:7242/ingest/d316ba9e-0be2-4ce9-a7ae-7380d7b3193b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'02a203'},body:JSON.stringify({sessionId:'02a203',runId:'pre-fix',hypothesisId:'H3',location:'src/pages/settings/SettingsTeam.tsx:resend:onClick',message:'Resend invitation clicked',data:{invitationId:invite.id,inviteStatus:invite.status,emailDomain:invite.email.split('@')[1] ?? null},timestamp:Date.now()})}).catch(()=>{});
                                // #endregion
                                await runInviteAction(invite.id, "resend_invite");
                                toast.success("Invitation resent");
                                await fetchInvitations();
                              } catch (e: any) {
                                // #region agent log
                                fetch('http://127.0.0.1:7242/ingest/d316ba9e-0be2-4ce9-a7ae-7380d7b3193b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'02a203'},body:JSON.stringify({sessionId:'02a203',runId:'pre-fix',hypothesisId:'H4',location:'src/pages/settings/SettingsTeam.tsx:resend:catch',message:'Resend invitation failed',data:{invitationId:invite.id,errorMessage:e?.message ?? null,errorName:e?.name ?? null},timestamp:Date.now()})}).catch(()=>{});
                                // #endregion
                                toast.error(e?.message ?? "Failed to resend invitation");
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
                            } catch (e: any) {
                              toast.error(e?.message ?? "Failed to send password reset");
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
                            } catch (e: any) {
                              toast.error(e?.message ?? "Failed to set password");
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
                              } catch (e: any) {
                                toast.error(e?.message ?? "Failed to cancel invitation");
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
      </div>

      <InviteUserModal
        open={inviteModalOpen}
        onOpenChange={(open) => {
          setInviteModalOpen(open);
          if (!open) {
            fetchInvitations();
          }
        }}
      />
    </>
  );
}

