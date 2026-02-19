import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SemanticChip } from "@/components/chips/semantic";
import {
  Loader2,
  ChevronDown,
  Upload,
  X,
  Building2,
  UserPlus,
  Shield,
  Bell,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useTeams } from "@/hooks/useTeams";
import { supabase } from "@/integrations/supabase/client";

type UserType = "internal" | "external";

const INTERNAL_ROLES = [
  { value: "owner", label: "Owner", description: "Full organisation control" },
  { value: "manager", label: "Manager", description: "Manage properties, tasks & team" },
  { value: "staff", label: "Staff", description: "Execute tasks, view assigned properties" },
  { value: "viewer", label: "Viewer", description: "Read-only access" },
] as const;

const EXTERNAL_ROLES = [
  { value: "contractor", label: "Contractor", description: "Complete assigned tasks" },
  { value: "vendor", label: "Vendor", description: "Service provider access" },
  { value: "inspector", label: "Inspector", description: "Inspection & compliance access" },
] as const;

const AVATAR_COLORS = [
  "#8EC9CE", "#EB6834", "#6B8E9B", "#D4A373",
  "#A78BFA", "#F472B6", "#34D399", "#FBBF24",
];

interface InviteUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillFirstName?: string;
  prefillLastName?: string;
  prefillEmail?: string;
  onInviteSent?: (invitation: { email: string; firstName: string; lastName: string; role: string }) => void;
}

export function InviteUserModal({
  open,
  onOpenChange,
  prefillFirstName = "",
  prefillLastName = "",
  prefillEmail = "",
  onInviteSent,
}: InviteUserModalProps) {
  const { orgId } = useActiveOrg();
  const { members, refresh: refreshMembers } = useOrgMembers();
  const { data: properties = [] } = usePropertiesQuery();
  const { teams } = useTeams();

  // --- Form state ---
  const [userType, setUserType] = useState<UserType>("internal");
  const [firstName, setFirstName] = useState(prefillFirstName);
  const [lastName, setLastName] = useState(prefillLastName);
  const [email, setEmail] = useState(prefillEmail);
  const [emailError, setEmailError] = useState<string | null>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [role, setRole] = useState("");

  const [propertyAccess, setPropertyAccess] = useState<"all" | "selected">("all");
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);

  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [teamSearch, setTeamSearch] = useState("");

  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [sendEmail, setSendEmail] = useState(true);
  const [generateLink, setGenerateLink] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");

  const [notifyOnAssign, setNotifyOnAssign] = useState(true);
  const [notifyBeforeDue, setNotifyBeforeDue] = useState(true);
  const [notifyCompliance, setNotifyCompliance] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showOwnerWarning, setShowOwnerWarning] = useState(false);

  // Sync prefill values when modal opens
  useEffect(() => {
    if (open) {
      setFirstName(prefillFirstName);
      setLastName(prefillLastName);
      setEmail(prefillEmail);
    }
  }, [open, prefillFirstName, prefillLastName, prefillEmail]);

  // Reset on close
  const resetForm = useCallback(() => {
    setUserType("internal");
    setFirstName("");
    setLastName("");
    setEmail("");
    setEmailError(null);
    setAvatarUrl(null);
    setAvatarColor(AVATAR_COLORS[0]);
    setAvatarFile(null);
    setAvatarPreview(null);
    setRole("");
    setPropertyAccess("all");
    setSelectedPropertyIds([]);
    setSelectedTeamIds([]);
    setTeamSearch("");
    setTags([]);
    setTagInput("");
    setAdvancedOpen(false);
    setSendEmail(true);
    setGenerateLink(false);
    setInviteMessage("");
    setNotifyOnAssign(true);
    setNotifyBeforeDue(true);
    setNotifyCompliance(true);
    setIsSubmitting(false);
    setShowOwnerWarning(false);
  }, []);

  // Reset role when user type changes (roles differ)
  useEffect(() => {
    setRole("");
  }, [userType]);

  // External users must select specific properties
  useEffect(() => {
    if (userType === "external") {
      setPropertyAccess("selected");
    }
  }, [userType]);

  // Check if email already exists in org
  const existingMember = useMemo(
    () => members.find((m) => m.email?.toLowerCase() === email.trim().toLowerCase()),
    [members, email],
  );

  // Pending invitation check
  const [pendingInvitation, setPendingInvitation] = useState<{ id: string; email: string } | null>(null);
  useEffect(() => {
    if (!orgId || !email.trim()) {
      setPendingInvitation(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("invitations")
        .select("id, email")
        .eq("org_id", orgId)
        .eq("email", email.trim().toLowerCase())
        .eq("status", "pending")
        .maybeSingle();
      if (!cancelled) setPendingInvitation(data ?? null);
    })();
    return () => { cancelled = true; };
  }, [orgId, email]);

  const roles = userType === "internal" ? INTERNAL_ROLES : EXTERNAL_ROLES;
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  const filteredTeams = useMemo(() => {
    if (!teamSearch.trim()) return teams;
    const q = teamSearch.toLowerCase();
    return teams.filter((t) => t.name.toLowerCase().includes(q));
  }, [teams, teamSearch]);

  const validateEmail = (value: string) => {
    if (!value.trim()) {
      setEmailError(null);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setEmailError("Enter a valid email address");
      return;
    }
    if (existingMember) {
      setEmailError("User already in organisation");
      return;
    }
    setEmailError(null);
  };

  const canSubmit =
    firstName.trim() &&
    lastName.trim() &&
    email.trim() &&
    !emailError &&
    !existingMember &&
    role &&
    orgId &&
    (userType === "internal" || selectedPropertyIds.length > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error("You must be logged in to send invitations");

      let uploadedAvatarUrl: string | undefined;
      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `invite-avatars/${orgId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("user-avatars")
          .upload(fileName, avatarFile, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage
          .from("user-avatars")
          .getPublicUrl(fileName);
        uploadedAvatarUrl = publicUrl;
      }

      const { data, error } = await supabase.functions.invoke("invite-team-member", {
        body: {
          email: email.trim().toLowerCase(),
          org_id: orgId,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          role: role,
          is_external: userType === "external",
          property_ids: propertyAccess === "all" ? null : selectedPropertyIds,
          team_ids: selectedTeamIds.length > 0 ? selectedTeamIds : undefined,
          tags: tags.length > 0 ? tags : undefined,
          notification_prefs: {
            notify_on_assign: notifyOnAssign,
            notify_before_due: notifyBeforeDue,
            notify_compliance: notifyCompliance,
          },
          message: inviteMessage.trim() || undefined,
          send_email: sendEmail,
          avatar_url: uploadedAvatarUrl || undefined,
          avatar_color: !uploadedAvatarUrl ? avatarColor : undefined,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(
        pendingInvitation ? "Invitation resent" : "Invitation sent",
        { description: `Sent to ${email.trim()}` },
      );

      onInviteSent?.({
        email: email.trim().toLowerCase(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
      });

      await refreshMembers();
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      console.error("Error sending invitation:", err);
      toast.error(err.message || "Failed to send invitation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  const toggleProperty = (id: string) => {
    setSelectedPropertyIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const toggleTeam = (id: string) => {
    setSelectedTeamIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  const addTag = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto p-0 gap-0 rounded-[12px] shadow-e3">
        {/* ── HEADER ── */}
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-xl font-semibold">Invite User</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Add someone to your organisation.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          {/* ── 1. USER TYPE ── */}
          <section>
            <Label className="text-xs font-mono uppercase text-muted-foreground mb-2 block">
              User Type
            </Label>
            <RadioGroup
              value={userType}
              onValueChange={(v) => setUserType(v as UserType)}
              className="grid grid-cols-2 gap-3"
            >
              <label
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-[8px] cursor-pointer transition-all",
                  userType === "internal"
                    ? "shadow-inset bg-card"
                    : "shadow-e1 bg-background hover:bg-muted/30",
                )}
              >
                <RadioGroupItem value="internal" />
                <div>
                  <p className="text-sm font-medium">Internal Team Member</p>
                  <p className="text-xs text-muted-foreground">Staff, managers & owners</p>
                </div>
              </label>
              <label
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-[8px] cursor-pointer transition-all",
                  userType === "external"
                    ? "shadow-inset bg-card"
                    : "shadow-e1 bg-background hover:bg-muted/30",
                )}
              >
                <RadioGroupItem value="external" />
                <div>
                  <p className="text-sm font-medium">External Contractor / Vendor</p>
                  <p className="text-xs text-muted-foreground">Suppliers & inspectors</p>
                </div>
              </label>
            </RadioGroup>
          </section>

          {/* ── 2. CORE IDENTITY ── */}
          <section className="space-y-3">
            <Label className="text-xs font-mono uppercase text-muted-foreground block">
              Identity
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inv-first" className="text-sm">First Name *</Label>
                <Input
                  id="inv-first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                  disabled={isSubmitting}
                  className="shadow-engraved border-0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-last" className="text-sm">Last Name *</Label>
                <Input
                  id="inv-last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Smith"
                  disabled={isSubmitting}
                  className="shadow-engraved border-0"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-email" className="text-sm">Email *</Label>
              <Input
                id="inv-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  validateEmail(e.target.value);
                }}
                onBlur={() => validateEmail(email)}
                placeholder="jane@company.com"
                disabled={isSubmitting}
                className={cn(
                  "shadow-engraved border-0",
                  emailError && "ring-2 ring-destructive/40",
                )}
              />
              {emailError && (
                <p className="text-xs text-destructive mt-1">{emailError}</p>
              )}
            </div>
          </section>

          {/* ── 3. AVATAR ── */}
          <section className="space-y-3">
            <Label className="text-xs font-mono uppercase text-muted-foreground block">
              Avatar
            </Label>
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Avatar className="h-12 w-12 shadow-e1">
                  {avatarPreview || avatarUrl ? (
                    <AvatarImage src={avatarPreview || avatarUrl || undefined} />
                  ) : (
                    <AvatarFallback
                      className="text-sm font-semibold text-white"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {initials || "?"}
                    </AvatarFallback>
                  )}
                </Avatar>
                {(avatarPreview || avatarUrl) && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarFile(null);
                      setAvatarPreview(null);
                      setAvatarUrl(null);
                      if (avatarInputRef.current) avatarInputRef.current.value = "";
                    }}
                    className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {AVATAR_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        setAvatarColor(color);
                        setAvatarUrl(null);
                        setAvatarFile(null);
                        setAvatarPreview(null);
                        if (avatarInputRef.current) avatarInputRef.current.value = "";
                      }}
                      className={cn(
                        "h-6 w-6 rounded-full transition-all",
                        avatarColor === color && !avatarUrl && !avatarPreview
                          ? "ring-2 ring-offset-2 ring-primary scale-110"
                          : "hover:scale-105",
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (!file.type.startsWith("image/")) {
                        toast.error("Please select an image file");
                        return;
                      }
                      if (file.size > 5 * 1024 * 1024) {
                        toast.error("Image must be less than 5 MB");
                        return;
                      }
                      setAvatarFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => setAvatarPreview(reader.result as string);
                      reader.readAsDataURL(file);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Upload className="h-3 w-3" />
                    Upload photo
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ── 4. ROLE & PERMISSIONS ── */}
          <section className="space-y-3">
            <Label className="text-xs font-mono uppercase text-muted-foreground block">
              Role
            </Label>
            <Select value={role} onValueChange={(v) => {
              if (v === "owner") {
                setShowOwnerWarning(true);
              }
              setRole(v);
            }}>
              <SelectTrigger className="shadow-engraved border-0">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    <div className="flex flex-col">
                      <span>{r.label}</span>
                      <span className="text-xs text-muted-foreground">{r.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {showOwnerWarning && role === "owner" && (
              <div className="flex items-start gap-2 p-3 rounded-[8px] bg-amber-50 dark:bg-amber-950/30 shadow-e1">
                <Shield className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-200">
                  Owners have full control over the organisation, including billing and member management. Are you sure?
                </p>
              </div>
            )}
          </section>

          {/* ── 5. PROPERTY ACCESS ── */}
          <section className="space-y-3">
            <Label className="text-xs font-mono uppercase text-muted-foreground block">
              Property Access
            </Label>
            {userType === "internal" && (
              <div className="flex items-center gap-2 mb-2">
                <Checkbox
                  id="all-props"
                  checked={propertyAccess === "all"}
                  onCheckedChange={(checked) =>
                    setPropertyAccess(checked ? "all" : "selected")
                  }
                />
                <Label htmlFor="all-props" className="text-sm cursor-pointer">
                  All Properties
                </Label>
              </div>
            )}
            {(propertyAccess === "selected" || userType === "external") && (
              <div className="max-h-[160px] overflow-y-auto space-y-1 rounded-[8px] p-2 shadow-engraved bg-background">
                {properties.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2">No properties found</p>
                ) : (
                  properties.map((prop: any) => (
                    <label
                      key={prop.id}
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-[6px] cursor-pointer transition-colors",
                        selectedPropertyIds.includes(prop.id)
                          ? "bg-primary/10"
                          : "hover:bg-muted/30",
                      )}
                    >
                      <Checkbox
                        checked={selectedPropertyIds.includes(prop.id)}
                        onCheckedChange={() => toggleProperty(prop.id)}
                      />
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">
                          {prop.nickname || prop.address || prop.id}
                        </span>
                      </div>
                    </label>
                  ))
                )}
              </div>
            )}
            {userType === "external" && selectedPropertyIds.length === 0 && role && (
              <p className="text-xs text-destructive">
                External users must be assigned to at least one property
              </p>
            )}
          </section>

          {/* ── 6. TEAM ALLOCATION ── */}
          <section className="space-y-3">
            <Label className="text-xs font-mono uppercase text-muted-foreground block">
              Teams
            </Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {selectedTeamIds.map((id) => {
                const team = teams.find((t) => t.id === id);
                return team ? (
                  <SemanticChip
                    key={id}
                    epistemic="fact"
                    label={team.name}
                    removable
                    onRemove={() => toggleTeam(id)}
                    className="shrink-0"
                  />
                ) : null;
              })}
              <div className="relative">
                <Input
                  value={teamSearch}
                  onChange={(e) => setTeamSearch(e.target.value)}
                  placeholder="+Team"
                  className="h-7 w-28 text-xs shadow-engraved border-0"
                  disabled={isSubmitting}
                />
                {teamSearch.trim() && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-background rounded-[8px] shadow-e3 z-50 max-h-[140px] overflow-y-auto">
                    {filteredTeams.map((team) => (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => { toggleTeam(team.id); setTeamSearch(""); }}
                        className={cn(
                          "w-full text-left px-3 py-1.5 text-sm hover:bg-muted/40 transition-colors",
                          selectedTeamIds.includes(team.id) && "text-primary font-medium",
                        )}
                      >
                        {team.name}
                      </button>
                    ))}
                    {filteredTeams.length === 0 && (
                      <p className="px-3 py-2 text-xs text-muted-foreground">No teams match</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── 7. TAG ALLOCATION ── */}
          <section className="space-y-3">
            <Label className="text-xs font-mono uppercase text-muted-foreground block">
              Tags
            </Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((tag) => (
                <SemanticChip
                  key={tag}
                  epistemic="fact"
                  label={tag}
                  removable
                  onRemove={() => removeTag(tag)}
                  className="shrink-0"
                />
              ))}
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagInput.trim()) {
                    e.preventDefault();
                    addTag(tagInput);
                  }
                }}
                onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                placeholder="+Tag"
                className="h-7 w-36 text-xs shadow-engraved border-0"
                disabled={isSubmitting}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              e.g. Night Shift, Certified Electrician, Emergency Contact
            </p>
          </section>

          {/* ── 8. ADVANCED RESTRICTIONS (collapsed) ── */}
          {(role === "owner" || role === "manager") && (
            <section>
              <button
                type="button"
                onClick={() => setAdvancedOpen(!advancedOpen)}
                className="flex items-center gap-2 text-xs font-mono uppercase text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", advancedOpen && "rotate-180")} />
                Advanced Access Restrictions
              </button>
              {advancedOpen && (
                <div className="mt-3 p-4 rounded-[8px] shadow-engraved bg-background space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Optionally restrict this user to specific spaces or asset types.
                    Leave blank for full access within assigned properties.
                  </p>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Space restrictions</Label>
                    <Input
                      placeholder="Not implemented yet"
                      disabled
                      className="shadow-engraved border-0 opacity-50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Asset type restrictions</Label>
                    <Input
                      placeholder="Not implemented yet"
                      disabled
                      className="shadow-engraved border-0 opacity-50"
                    />
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── 9. NOTIFICATION PREFERENCES ── */}
          <section className="space-y-3">
            <Label className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-1.5">
              <Bell className="h-3 w-3" /> Notification Preferences
            </Label>
            <div className="space-y-2">
              {[
                { id: "notify-assign", label: "Notify when assigned a task", checked: notifyOnAssign, set: setNotifyOnAssign },
                { id: "notify-due", label: "Notify before due dates", checked: notifyBeforeDue, set: setNotifyBeforeDue },
                { id: "notify-compliance", label: "Notify on compliance alerts", checked: notifyCompliance, set: setNotifyCompliance },
              ].map((pref) => (
                <label key={pref.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    id={pref.id}
                    checked={pref.checked}
                    onCheckedChange={(c) => pref.set(!!c)}
                  />
                  <span className="text-sm">{pref.label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* ── 10. INVITATION SETTINGS ── */}
          <section className="space-y-3">
            <Label className="text-xs font-mono uppercase text-muted-foreground block">
              Invitation
            </Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={sendEmail}
                  onCheckedChange={(c) => setSendEmail(!!c)}
                />
                <span className="text-sm">Send invite email immediately</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={generateLink}
                  onCheckedChange={(c) => setGenerateLink(!!c)}
                />
                <span className="text-sm">Generate invite link manually</span>
              </label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-msg" className="text-sm">
                Message <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="inv-msg"
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                placeholder="Welcome to our property management team..."
                rows={3}
                disabled={isSubmitting}
                className="shadow-engraved border-0 resize-none"
              />
            </div>
          </section>
        </div>

        {/* ── FOOTER ── */}
        <DialogFooter className="px-6 pb-6 pt-2 border-t border-border/40">
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={isSubmitting}
            className="shadow-e1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="shadow-e1 bg-primary hover:bg-primary/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : pendingInvitation ? (
              "Resend Invitation"
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Send Invitation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
