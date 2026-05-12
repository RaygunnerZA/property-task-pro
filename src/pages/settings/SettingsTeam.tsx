import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useOrgMembers, type OrgMember } from "@/hooks/useOrgMembers";
import {
  Loader2,
  RotateCcw,
  UserRoundCog,
  KeyRound,
  Ban,
  Shield,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronUp,
  Mail,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
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

// ─── Edit member inline panel ─────────────────────────────────────────────────
interface EditMemberPanelProps {
  member: OrgMember;
  propertyOptions: { id: string; label: string }[];
  onSave: (
    memberId: string,
    role: string,
    propertyIds: string[] | null,
    profile: { first_name: string; last_name: string; email: string }
  ) => Promise<void>;
  onClose: () => void;
}

function EditMemberPanel({ member, propertyOptions, onSave, onClose }: EditMemberPanelProps) {
  const [firstName, setFirstName] = useState(member.first_name ?? "");
  const [lastName, setLastName] = useState(member.last_name ?? "");
  const [email, setEmail] = useState(member.email ?? "");
  const [role, setRole] = useState(member.role);
  const [selectedProps, setSelectedProps] = useState<string[]>(member.assigned_properties ?? []);
  const [allProperties, setAllProperties] = useState(
    !member.assigned_properties || member.assigned_properties.length === 0
  );
  const [saving, setSaving] = useState(false);

  const toggleProp = (id: string) => {
    setSelectedProps((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(member.id, role, allProperties ? null : selectedProps, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 rounded-[10px] border border-primary/20 bg-primary/5 p-3 space-y-3 shadow-sm">
      {/* Name row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">First name</Label>
          <Input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First"
            className="h-9 text-sm shadow-engraved"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last name</Label>
          <Input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last"
            className="h-9 text-sm shadow-engraved"
          />
        </div>
      </div>

      {/* Email */}
      <div className="space-y-1">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email address</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          className="h-9 text-sm shadow-engraved"
        />
      </div>

      {/* Role */}
      <div className="space-y-1">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Role</Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="h-9 text-sm shadow-engraved">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <div className="px-2 py-1 text-[10px] font-mono uppercase text-muted-foreground tracking-wider">Internal</div>
            {INTERNAL_ORG_ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
                <span className="ml-2 text-xs text-muted-foreground">{r.description}</span>
              </SelectItem>
            ))}
            <div className="px-2 py-1 text-[10px] font-mono uppercase text-muted-foreground tracking-wider border-t mt-1 pt-2">External</div>
            {EXTERNAL_ORG_ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
                <span className="ml-2 text-xs text-muted-foreground">{r.description}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Property access */}
      {propertyOptions.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Property access</Label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={allProperties}
              onChange={(e) => {
                setAllProperties(e.target.checked);
                if (e.target.checked) setSelectedProps([]);
              }}
              className="rounded border-input accent-primary"
            />
            All properties
          </label>
          {!allProperties && (
            <div className="space-y-1 pl-1 max-h-40 overflow-y-auto">
              {propertyOptions.map((prop) => (
                <label key={prop.id} className="flex items-center gap-2 cursor-pointer text-sm py-0.5">
                  <input
                    type="checkbox"
                    checked={selectedProps.includes(prop.id)}
                    onChange={() => toggleProp(prop.id)}
                    className="rounded border-input accent-primary"
                  />
                  <span className="truncate">{prop.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="outline" className="flex-1 shadow-e1" onClick={onClose} disabled={saving}>
          <X className="h-3.5 w-3.5 mr-1.5" />
          Cancel
        </Button>
        <Button size="sm" className="flex-1 shadow-primary-btn" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
          Save
        </Button>
      </div>
    </div>
  );
}

// ─── Edit invitation inline panel ─────────────────────────────────────────────
interface EditInvitePanelProps {
  invite: InvitationRecord;
  propertyOptions: { id: string; label: string }[];
  onSave: (inviteId: string, role: string, propertyIds: string[] | null) => Promise<void>;
  onClose: () => void;
}

function EditInvitePanel({ invite, propertyOptions, onSave, onClose }: EditInvitePanelProps) {
  const [role, setRole] = useState(invite.role);
  const [selectedProps, setSelectedProps] = useState<string[]>(invite.property_ids ?? []);
  const [allProperties, setAllProperties] = useState(
    !invite.property_ids || invite.property_ids.length === 0
  );
  const [saving, setSaving] = useState(false);

  const toggleProp = (id: string) => {
    setSelectedProps((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(invite.id, role, allProperties ? null : selectedProps);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 rounded-[10px] border border-primary/20 bg-primary/5 p-3 space-y-3 shadow-sm">
      <div className="space-y-1">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Role</Label>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="h-9 text-sm shadow-engraved">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <div className="px-2 py-1 text-[10px] font-mono uppercase text-muted-foreground tracking-wider">Internal</div>
            {INTERNAL_ORG_ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
            <div className="px-2 py-1 text-[10px] font-mono uppercase text-muted-foreground tracking-wider border-t mt-1 pt-2">External</div>
            {EXTERNAL_ORG_ROLES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {propertyOptions.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Property access</Label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={allProperties}
              onChange={(e) => {
                setAllProperties(e.target.checked);
                if (e.target.checked) setSelectedProps([]);
              }}
              className="rounded border-input accent-primary"
            />
            All properties
          </label>
          {!allProperties && (
            <div className="space-y-1 pl-1 max-h-40 overflow-y-auto">
              {propertyOptions.map((prop) => (
                <label key={prop.id} className="flex items-center gap-2 cursor-pointer text-sm py-0.5">
                  <input
                    type="checkbox"
                    checked={selectedProps.includes(prop.id)}
                    onChange={() => toggleProp(prop.id)}
                    className="rounded border-input accent-primary"
                  />
                  <span className="truncate">{prop.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="outline" className="flex-1 shadow-e1" onClick={onClose} disabled={saving}>
          <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
        </Button>
        <Button size="sm" className="flex-1 shadow-primary-btn" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
          Save & Resend
        </Button>
      </div>
    </div>
  );
}

// ─── Set-password inline dialog ────────────────────────────────────────────────
interface SetPasswordDialogProps {
  inviteName: string;
  onConfirm: (password: string) => Promise<void>;
  onClose: () => void;
}

function SetPasswordDialog({ inviteName, onConfirm, onClose }: SetPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleConfirm = async () => {
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSaving(true);
    try {
      await onConfirm(password);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 rounded-[10px] border border-primary/20 bg-primary/5 p-3 space-y-3 shadow-sm">
      <p className="text-sm font-medium">Set password for <span className="text-primary">{inviteName}</span></p>
      <Input
        ref={inputRef}
        type="password"
        placeholder="Min 8 characters"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") void handleConfirm(); if (e.key === "Escape") onClose(); }}
        className="h-9 shadow-engraved"
      />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1 shadow-e1" onClick={onClose} disabled={saving}>
          <X className="h-3.5 w-3.5 mr-1.5" /> Cancel
        </Button>
        <Button size="sm" className="flex-1 shadow-primary-btn" onClick={handleConfirm} disabled={saving || password.length < 8}>
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
          Grant Access
        </Button>
      </div>
    </div>
  );
}

// ─── Role badge ────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const isOwner = role === "owner";
  const isManager = role === "manager";
  const isExternal = ["contractor", "vendor", "inspector"].includes(role);
  return (
    <Badge
      variant={isOwner ? "default" : isManager ? "secondary" : "outline"}
      className={cn(
        "w-fit shrink-0 text-[11px] font-mono uppercase",
        isOwner && "bg-primary text-primary-foreground",
        isManager && "bg-secondary text-secondary-foreground",
        isExternal && "border-accent/40 text-accent"
      )}
    >
      {role}
    </Badge>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function SettingsTeam() {
  const queryClient = useQueryClient();
  const { members, loading, error, refresh: refreshMembers } = useOrgMembers();
  const { orgId } = useActiveOrg();
  const { setRightPanel } = useSettingsWorkbench();
  const { data: properties = [] } = usePropertiesQuery();

  const propertyOptions = useMemo(
    () =>
      properties.map((p) => ({
        id: p.id,
        label: p.nickname || p.address || p.id,
      })),
    [properties]
  );

  const [teamTab, setTeamTab] = useState<TeamWorkbenchTab>("members");
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  // Edit / delete member state
  const [editMemberId, setEditMemberId] = useState<string | null>(null);
  const [deleteMemberId, setDeleteMemberId] = useState<string | null>(null);

  // Invite action state
  const [editInviteId, setEditInviteId] = useState<string | null>(null);
  const [passwordInviteId, setPasswordInviteId] = useState<string | null>(null);

  const deleteMember = useMemo(
    () => members.find((m) => m.id === deleteMemberId) ?? null,
    [members, deleteMemberId]
  );

  // ── Fetch invitations ──────────────────────────────────────────────────────
  const fetchInvitations = useCallback(async () => {
    if (!orgId) { setInvitations([]); return; }
    setLoadingInvites(true);
    try {
      const { data, error: inviteError } = await supabase
        .from("invitations")
        .select("id, email, first_name, last_name, role, status, created_at, accepted_at, expires_at, property_ids")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (inviteError) throw inviteError;
      setInvitations((data ?? []) as InvitationRecord[]);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load invitations");
    } finally {
      setLoadingInvites(false);
    }
  }, [orgId]);

  useEffect(() => { fetchInvitations(); }, [fetchInvitations]);

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
          description="What each preset can do in Filla today."
          className="bg-card/80"
        >
          <ul className="space-y-2 px-4 pb-4 text-xs text-muted-foreground leading-relaxed">
            <li><span className="font-medium text-foreground">Invite flow</span> — assign a role when you send an invitation.</li>
            <li><span className="font-medium text-foreground">Coming next</span> — custom org roles, per-module permissions, and property-scoped overrides.</li>
          </ul>
        </WorkspaceSurfaceCard>
      );
    }
    return () => setRightPanel(null);
  }, [teamTab, setRightPanel, fetchInvitations, queryClient]);

  // ── Save member edits ──────────────────────────────────────────────────────
  const handleSaveMember = useCallback(
    async (
      memberId: string,
      role: string,
      propertyIds: string[] | null,
      profile: { first_name: string; last_name: string; email: string }
    ) => {
      if (!orgId) throw new Error("No organisation");

      // 1. Update role + property access in organisation_members
      const { error: memberError } = await supabase
        .from("organisation_members")
        .update({ role, assigned_properties: propertyIds })
        .eq("id", memberId)
        .eq("org_id", orgId);
      if (memberError) throw memberError;

      // 2. Update name / email in auth via edge function (requires service role)
      const hasProfileChange =
        profile.first_name || profile.last_name || profile.email;
      if (hasProfileChange) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session) {
          const { data, error: fnError } = await supabase.functions.invoke(
            "manage-invited-users",
            {
              body: {
                action: "update_member_profile",
                org_member_id: memberId,
                first_name: profile.first_name || null,
                last_name: profile.last_name || null,
                email: profile.email || undefined,
              },
              headers: {
                Authorization: `Bearer ${sessionData.session.access_token}`,
              },
            }
          );
          if (fnError) throw fnError;
          if (data?.error) throw new Error(data.error);
        }
      }

      toast.success("Member updated");
      await refreshMembers();
    },
    [orgId, refreshMembers]
  );

  // ── Remove member ──────────────────────────────────────────────────────────
  const handleRemoveMember = useCallback(
    async (memberId: string) => {
      if (!orgId) return;
      const { error } = await supabase
        .from("organisation_members")
        .delete()
        .eq("id", memberId)
        .eq("org_id", orgId);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Member removed from organisation");
      setDeleteMemberId(null);
      await refreshMembers();
    },
    [orgId, refreshMembers]
  );

  // ── Invite edge-function helper ────────────────────────────────────────────
  const runInviteAction = useCallback(
    async (invitationId: string, action: string, newPassword?: string) => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error("You must be logged in");
      const { data, error: invokeError } = await supabase.functions.invoke("manage-invited-users", {
        body: { action, invitation_id: invitationId, ...(newPassword ? { new_password: newPassword } : {}) },
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
    },
    []
  );

  const deleteInvitationRow = useCallback(
    async (invitationId: string) => {
      if (!orgId) throw new Error("No organisation selected");
      const { data, error } = await supabase
        .from("invitations")
        .delete()
        .eq("id", invitationId)
        .eq("org_id", orgId)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Couldn't remove invitation. You may not have permission.");
    },
    [orgId]
  );

  // ── Save invitation edits ──────────────────────────────────────────────────
  const handleSaveInvite = useCallback(
    async (inviteId: string, role: string, propertyIds: string[] | null) => {
      if (!orgId) throw new Error("No organisation");
      const { error } = await supabase
        .from("invitations")
        .update({ role, property_ids: propertyIds })
        .eq("id", inviteId)
        .eq("org_id", orgId);
      if (error) throw error;
      // Resend so new role is emailed
      try { await runInviteAction(inviteId, "resend_invite"); } catch { /* non-fatal */ }
      toast.success("Invitation updated and resent");
      await fetchInvitations();
    },
    [orgId, runInviteAction, fetchInvitations]
  );

  const statusBadgeVariant = useMemo(
    () => ({ pending: "secondary", accepted: "default", expired: "outline", cancelled: "outline" }) as const,
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
      {/* Tab bar */}
      <div>
        <WorkspaceSectionHeading>Team workspace</WorkspaceSectionHeading>
        <WorkspaceTabList className="mt-2 max-sm:[&_button]:px-2 max-sm:[&_button]:text-[11px]">
          <WorkspaceTabTrigger selected={teamTab === "members"} onClick={() => setTeamTab("members")}>
            Team members
          </WorkspaceTabTrigger>
          <WorkspaceTabTrigger selected={teamTab === "invited"} onClick={() => setTeamTab("invited")}>
            Invited users
          </WorkspaceTabTrigger>
          <WorkspaceTabTrigger selected={teamTab === "roles"} onClick={() => setTeamTab("roles")}>
            Roles & permissions
          </WorkspaceTabTrigger>
        </WorkspaceTabList>
      </div>

      {/* ── Team members ── */}
      {teamTab === "members" && (
        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="text-base">Team members</CardTitle>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No team members yet. Use <strong>Invite member</strong>{" "}
                <span className="lg:hidden">below</span>
                <span className="hidden lg:inline">on the right</span> to add people.
              </p>
            ) : (
              <div className="space-y-2">
                {members.map((member) => {
                  const isEditing = editMemberId === member.id;
                  const assignedPropCount = member.assigned_properties?.length ?? 0;

                  return (
                    <div
                      key={member.id}
                      className={cn(
                        "rounded-[10px] border bg-card transition-all duration-200",
                        isEditing
                          ? "border-primary/30 shadow-sm"
                          : "border-border shadow-e1"
                      )}
                    >
                      <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                        {/* Avatar + name */}
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarImage src={member.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                              {member.display_name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-medium text-foreground leading-tight">{member.display_name}</p>
                            <p className="text-xs text-muted-foreground break-all">
                              {member.email || `${member.user_id.slice(0, 8)}…`}
                            </p>
                            {assignedPropCount > 0 && (
                              <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                                {assignedPropCount} propert{assignedPropCount === 1 ? "y" : "ies"} assigned
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Role + actions */}
                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                          <RoleBadge role={member.role} />

                          {/* Edit */}
                          <button
                            type="button"
                            onClick={() => setEditMemberId(isEditing ? null : member.id)}
                            title={isEditing ? "Close" : "Edit member"}
                            className={cn(
                              "h-8 w-8 rounded-[8px] flex items-center justify-center transition-colors",
                              "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                              isEditing && "bg-primary/10 text-primary"
                            )}
                          >
                            {isEditing ? <ChevronUp className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                          </button>

                          {/* Remove */}
                          {member.role !== "owner" && (
                            <button
                              type="button"
                              onClick={() => setDeleteMemberId(member.id)}
                              title="Remove member"
                              className="h-8 w-8 rounded-[8px] flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Edit panel */}
                      {isEditing && (
                        <div className="px-3 pb-3">
                          <EditMemberPanel
                            member={member}
                            propertyOptions={propertyOptions}
                            onSave={handleSaveMember}
                            onClose={() => setEditMemberId(null)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Invited users ── */}
      {teamTab === "invited" && (
        <Card className="shadow-e1">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Invited users</CardTitle>
            <Button
              onClick={() => void fetchInvitations()}
              size="sm"
              variant="outline"
              className="w-full shrink-0 sm:w-auto"
            >
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
                No invitations yet. Send one from the <strong>Invite member</strong> panel{" "}
                <span className="lg:hidden">below</span>
                <span className="hidden lg:inline">on the right</span>.
              </p>
            ) : (
              <div className="space-y-2">
                {invitations.map((invite) => {
                  const isBusy = actionBusyId === invite.id;
                  const isEditing = editInviteId === invite.id;
                  const isSettingPw = passwordInviteId === invite.id;

                  return (
                    <div
                      key={invite.id}
                      className={cn(
                        "rounded-[10px] border transition-all duration-200",
                        isEditing || isSettingPw
                          ? "border-primary/30 bg-card shadow-sm"
                          : "border-border bg-card shadow-e1"
                      )}
                    >
                      <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2 flex-wrap">
                            <div className="min-w-0">
                              <p className="font-medium text-foreground leading-tight">{formatName(invite)}</p>
                              <p className="text-xs text-muted-foreground break-all">{invite.email}</p>
                              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                <RoleBadge role={invite.role} />
                                <span className="text-muted-foreground/60">•</span>
                                <span>
                                  {invite.property_ids?.length
                                    ? `${invite.property_ids.length} propert${invite.property_ids.length === 1 ? "y" : "ies"}`
                                    : "All properties"}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground/70 mt-1">
                                Sent {new Date(invite.created_at).toLocaleString()}
                                {invite.accepted_at ? ` · Accepted ${new Date(invite.accepted_at).toLocaleString()}` : ""}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Status + actions */}
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <Badge
                            variant={statusBadgeVariant[invite.status]}
                            className={cn(
                              "w-fit text-[11px] font-mono uppercase",
                              invite.status === "accepted" && "bg-primary text-primary-foreground"
                            )}
                          >
                            {invite.status}
                          </Badge>

                          <div className="flex gap-1.5 flex-wrap justify-end">
                            {/* Edit (pending only) */}
                            {invite.status === "pending" && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => {
                                  setEditInviteId(isEditing ? null : invite.id);
                                  setPasswordInviteId(null);
                                }}
                                title="Edit invitation"
                                className={cn(
                                  "h-8 w-8 rounded-[8px] flex items-center justify-center transition-colors",
                                  "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                                  isEditing && "bg-primary/10 text-primary"
                                )}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            )}

                            {/* Resend (non-accepted) */}
                            {invite.status !== "accepted" && (
                              <button
                                type="button"
                                disabled={isBusy}
                                title="Resend invitation"
                                onClick={async () => {
                                  try {
                                    setActionBusyId(invite.id);
                                    await runInviteAction(invite.id, "resend_invite");
                                    toast.success("Invitation resent");
                                    await fetchInvitations();
                                  } catch (e: unknown) {
                                    toast.error(e instanceof Error ? e.message : "Failed to resend");
                                  } finally {
                                    setActionBusyId(null);
                                  }
                                }}
                                className="h-8 w-8 rounded-[8px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
                              >
                                {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                              </button>
                            )}

                            {/* Password reset */}
                            <button
                              type="button"
                              disabled={isBusy}
                              title="Send password reset"
                              onClick={async () => {
                                try {
                                  setActionBusyId(invite.id);
                                  await runInviteAction(invite.id, "send_password_reset");
                                  toast.success("Password reset email sent");
                                } catch (e: unknown) {
                                  toast.error(e instanceof Error ? e.message : "Failed");
                                } finally {
                                  setActionBusyId(null);
                                }
                              }}
                              className="h-8 w-8 rounded-[8px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
                            >
                              <KeyRound className="h-4 w-4" />
                            </button>

                            {/* Set password */}
                            <button
                              type="button"
                              disabled={isBusy}
                              title="Create / set password"
                              onClick={() => {
                                setPasswordInviteId(isSettingPw ? null : invite.id);
                                setEditInviteId(null);
                              }}
                              className={cn(
                                "h-8 w-8 rounded-[8px] flex items-center justify-center transition-colors",
                                "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                                isSettingPw && "bg-primary/10 text-primary"
                              )}
                            >
                              <UserRoundCog className="h-4 w-4" />
                            </button>

                            {/* Cancel pending */}
                            {invite.status === "pending" && (
                              <button
                                type="button"
                                disabled={isBusy}
                                title="Cancel invitation"
                                onClick={async () => {
                                  const snapshot = invitations;
                                  try {
                                    setActionBusyId(invite.id);
                                    setInvitations((prev) => prev.filter((i) => i.id !== invite.id));
                                    await deleteInvitationRow(invite.id);
                                    toast.success("Invitation cancelled");
                                  } catch (e: unknown) {
                                    setInvitations(snapshot);
                                    toast.error(e instanceof Error ? e.message : "Failed to cancel");
                                  } finally {
                                    setActionBusyId(null);
                                  }
                                }}
                                className="h-8 w-8 rounded-[8px] flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                              >
                                <Ban className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Edit invitation panel */}
                      {isEditing && (
                        <div className="px-3 pb-3">
                          <EditInvitePanel
                            invite={invite}
                            propertyOptions={propertyOptions}
                            onSave={handleSaveInvite}
                            onClose={() => setEditInviteId(null)}
                          />
                        </div>
                      )}

                      {/* Set password panel */}
                      {isSettingPw && (
                        <div className="px-3 pb-3">
                          <SetPasswordDialog
                            inviteName={formatName(invite)}
                            onConfirm={async (pw) => {
                              setActionBusyId(invite.id);
                              try {
                                await runInviteAction(invite.id, "set_password_manual", pw);
                                toast.success("Password set and access granted");
                                await fetchInvitations();
                              } finally {
                                setActionBusyId(null);
                              }
                            }}
                            onClose={() => setPasswordInviteId(null)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Roles & permissions ── */}
      {teamTab === "roles" && (
        <div className="space-y-6">
          <WorkspaceSurfaceCard title="Internal roles" className="bg-card/80">
            <div className="space-y-3 px-4 pb-4">
              {INTERNAL_ORG_ROLES.map((r) => (
                <div key={r.value} className="rounded-[8px] border border-border/40 bg-background/60 px-3 py-2.5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="text-sm font-medium">{r.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{r.description}</p>
                </div>
              ))}
            </div>
          </WorkspaceSurfaceCard>

          <WorkspaceSurfaceCard title="External roles" className="bg-card/80">
            <div className="space-y-3 px-4 pb-4">
              {EXTERNAL_ORG_ROLES.map((r) => (
                <div key={r.value} className="rounded-[8px] border border-border/40 bg-background/60 px-3 py-2.5 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5 shrink-0 text-accent" />
                    <span className="text-sm font-medium">{r.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{r.description}</p>
                </div>
              ))}
            </div>
          </WorkspaceSurfaceCard>

          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong>User permissions</strong> — advanced per-user, per-module overrides will live here once
            the policy layer ships. Until then, role + property access from invitations define what someone can
            see and do.
          </p>
        </div>
      )}

      {/* ── Remove member confirmation ── */}
      <AlertDialog open={!!deleteMemberId} onOpenChange={(open) => { if (!open) setDeleteMemberId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteMember?.display_name ?? "This member"}</strong> will lose access to your
              organisation. Their tasks and data remain unchanged. This cannot be undone without re-inviting them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteMemberId) void handleRemoveMember(deleteMemberId); }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
