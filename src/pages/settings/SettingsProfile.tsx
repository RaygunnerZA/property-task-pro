import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import { getAppBaseUrl, cn } from "@/lib/utils";
import {
  Loader2,
  Save,
  Upload,
  X,
  User as UserIcon,
  Mail,
  Shield,
  Building2,
  FileText,
  ExternalLink,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AvatarCropDialog } from "@/components/profile/AvatarCropDialog";
import {
  clearUserAvatarFolder,
  uploadAvatarVariants,
} from "@/lib/avatarImage";
import { toast } from "sonner";

const AVATAR_COLORS = [
  "#8EC9CE", "#EB6834", "#6B8E9B", "#D4A373",
  "#A78BFA", "#F472B6", "#34D399", "#FBBF24",
];

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function PasswordField({
  id,
  label,
  value,
  onChange,
  disabled,
  autoComplete,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoComplete?: string;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      <div className="relative w-full">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="w-full pr-10 shadow-engraved border-0"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={visible ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default function SettingsProfile() {
  const { role, isLoading: roleLoading } = useCurrentUserRole();

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarMediumUrl, setAvatarMediumUrl] = useState<string | null>(null);
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);

  const [editNickname, setEditNickname] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [pendingSmallBlob, setPendingSmallBlob] = useState<Blob | null>(null);
  const [pendingMediumBlob, setPendingMediumBlob] = useState<Blob | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasProfileChanges, setHasProfileChanges] = useState(false);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailConfirmPassword, setEmailConfirmPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [updatingEmail, setUpdatingEmail] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  const isExternal = role === "contractor" || role === "vendor" || role === "inspector";
  const emailChanged =
    editEmail.trim().toLowerCase() !== userEmail.trim().toLowerCase();

  const hydrateUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    setUserEmail(user.email || "");
    setEditEmail(user.email || "");
    setPendingEmail(user.new_email ?? null);
    setNickname(user.user_metadata?.nickname || "");
    setEditNickname(user.user_metadata?.nickname || "");
    setAvatarUrl(user.user_metadata?.avatar_url || null);
    setAvatarMediumUrl(user.user_metadata?.avatar_medium_url || null);
    setAvatarColor(user.user_metadata?.avatar_color || AVATAR_COLORS[0]);
    setAvatarRemoved(false);
  };

  useEffect(() => {
    async function load() {
      await hydrateUser();
      setLoading(false);
    }
    void load();
  }, []);

  useEffect(() => {
    const nicknameChanged = editNickname !== nickname;
    const avatarChanged =
      !!pendingSmallBlob || !!pendingMediumBlob || avatarRemoved;
    setHasProfileChanges(nicknameChanged || avatarChanged);
  }, [editNickname, nickname, pendingSmallBlob, pendingMediumBlob, avatarRemoved]);

  const revokePreview = () => {
    if (avatarPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreview);
    }
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (cropSource?.startsWith("blob:")) URL.revokeObjectURL(cropSource);
    const objectUrl = URL.createObjectURL(file);
    setCropSource(objectUrl);
    setCropOpen(true);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  const handleCropConfirm = ({
    small,
    medium,
    previewUrl,
  }: {
    small: Blob;
    medium: Blob;
    previewUrl: string;
  }) => {
    revokePreview();
    setPendingSmallBlob(small);
    setPendingMediumBlob(medium);
    setAvatarPreview(previewUrl);
    setAvatarRemoved(false);
  };

  const handleRemoveAvatar = () => {
    revokePreview();
    setPendingSmallBlob(null);
    setPendingMediumBlob(null);
    setAvatarPreview(null);
    setAvatarUrl(null);
    setAvatarMediumUrl(null);
    setAvatarRemoved(true);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);

    try {
      let newAvatarUrl = avatarRemoved ? null : avatarUrl;
      let newAvatarMediumUrl = avatarRemoved ? null : avatarMediumUrl;

      if (pendingSmallBlob && pendingMediumBlob) {
        const uploaded = await uploadAvatarVariants(
          userId,
          pendingSmallBlob,
          pendingMediumBlob,
          [avatarUrl, avatarMediumUrl],
        );
        newAvatarUrl = uploaded.avatarUrl;
        newAvatarMediumUrl = uploaded.avatarMediumUrl;
      } else if (avatarRemoved) {
        await clearUserAvatarFolder(userId, [avatarUrl, avatarMediumUrl]);
        newAvatarUrl = null;
        newAvatarMediumUrl = null;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          nickname: editNickname.trim() || null,
          avatar_url: newAvatarUrl,
          avatar_medium_url: newAvatarMediumUrl,
          avatar_color: avatarColor,
        },
      });
      if (updateError) throw updateError;

      toast.success("Profile updated");
      await supabase.auth.refreshSession();
      setNickname(editNickname.trim());
      setAvatarUrl(newAvatarUrl);
      setAvatarMediumUrl(newAvatarMediumUrl);
      revokePreview();
      setPendingSmallBlob(null);
      setPendingMediumBlob(null);
      setAvatarPreview(null);
      setAvatarRemoved(false);
      setHasProfileChanges(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      console.error("Error updating profile:", err);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const resetPasswordForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
  };

  const handlePasswordDialogChange = (open: boolean) => {
    setPasswordOpen(open);
    if (!open) resetPasswordForm();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (!userEmail) {
      setPasswordError("Your account email is required to change password.");
      return;
    }
    if (!currentPassword) {
      setPasswordError("Enter your current password.");
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError("New password must be different from your current password.");
      return;
    }

    setChangingPassword(true);
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: currentPassword,
      });
      if (reauthError) {
        setPasswordError("Current password is incorrect.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      await supabase.auth.refreshSession();
      toast.success("Password updated");
      handlePasswordDialogChange(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update password";
      console.error("Error changing password:", err);
      toast.error(message);
      setPasswordError(message);
    } finally {
      setChangingPassword(false);
    }
  };

  const openEmailDialog = () => {
    const next = editEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(next)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (next === userEmail.trim().toLowerCase()) {
      toast.info("That is already your current email");
      return;
    }
    setEmailError(null);
    setEmailConfirmPassword("");
    setEmailDialogOpen(true);
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);

    const nextEmail = editEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(nextEmail)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    if (!emailConfirmPassword) {
      setEmailError("Enter your current password to confirm.");
      return;
    }

    setUpdatingEmail(true);
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: userEmail,
        password: emailConfirmPassword,
      });
      if (reauthError) {
        setEmailError("Current password is incorrect.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser(
        { email: nextEmail },
        { emailRedirectTo: `${getAppBaseUrl()}/settings/profile` }
      );
      if (updateError) throw updateError;

      await hydrateUser();
      setEmailDialogOpen(false);
      setEmailConfirmPassword("");
      toast.success("Verification email sent", {
        description: `Confirm the link sent to ${nextEmail} (and check your current inbox if prompted).`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update email";
      console.error("Error updating email:", err);
      toast.error(message);
      setEmailError(message);
    } finally {
      setUpdatingEmail(false);
    }
  };

  const handleResendEmailVerification = async () => {
    const target = pendingEmail || editEmail.trim().toLowerCase();
    if (!target || !EMAIL_REGEX.test(target)) {
      toast.error("No pending email to verify");
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser(
        { email: target },
        { emailRedirectTo: `${getAppBaseUrl()}/settings/profile` }
      );
      if (error) throw error;
      await hydrateUser();
      toast.success("Verification email resent", {
        description: `Check ${target} for the confirmation link.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to resend verification";
      toast.error(message);
    }
  };

  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const initials = (editNickname || userEmail || "U").slice(0, 2).toUpperCase();
  const displayAvatarSrc =
    avatarPreview || avatarMediumUrl || avatarUrl || undefined;

  return (
    <div className="space-y-6">
      <AvatarCropDialog
        open={cropOpen}
        imageSrc={cropSource}
        onOpenChange={(open) => {
          setCropOpen(open);
          if (!open && cropSource?.startsWith("blob:")) {
            URL.revokeObjectURL(cropSource);
            setCropSource(null);
          }
        }}
        onConfirm={handleCropConfirm}
      />
      <Card className="shadow-e1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Your Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex w-full min-w-0 flex-col items-stretch gap-5 sm:flex-row sm:items-center">
            <div className="relative group shrink-0">
              <Avatar className="h-20 w-20 shadow-e1">
                {displayAvatarSrc ? (
                  <AvatarImage src={displayAvatarSrc} />
                ) : (
                  <AvatarFallback
                    className="text-lg font-semibold text-white"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
              {displayAvatarSrc && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex max-w-full flex-wrap gap-1.5">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      setAvatarColor(color);
                      handleRemoveAvatar();
                    }}
                    className={cn(
                      "h-6 w-6 rounded-full transition-all",
                      avatarColor === color && !displayAvatarSrc
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
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleAvatarSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => avatarInputRef.current?.click()}
                  className="shadow-e1"
                >
                  <Upload className="mr-2 h-3.5 w-3.5" />
                  Upload photo
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-nickname" className="text-sm">
              Display Name
            </Label>
            <Input
              id="profile-nickname"
              value={editNickname}
              onChange={(e) => setEditNickname(e.target.value)}
              placeholder="Your name or nickname"
              disabled={saving}
              className="w-full max-w-full shadow-engraved border-0 sm:max-w-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="profile-email" className="text-sm flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              Email
            </Label>
            <Input
              id="profile-email"
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              disabled={updatingEmail}
              autoComplete="email"
              className="w-full max-w-full shadow-engraved border-0 sm:max-w-sm"
            />
            {pendingEmail ? (
              <div className="rounded-card bg-muted/60 px-3 py-2 text-xs text-muted-foreground sm:max-w-sm">
                <p>
                  Pending verification for <span className="font-medium text-foreground">{pendingEmail}</span>.
                  Confirm the link in that inbox to finish the change.
                </p>
                <button
                  type="button"
                  onClick={() => void handleResendEmailVerification()}
                  className="mt-1.5 font-medium text-primary hover:underline"
                >
                  Resend verification email
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Changing email sends a verification link. Confirm it to complete the update.
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openEmailDialog}
                disabled={!emailChanged || updatingEmail}
                className="shadow-e1"
              >
                <Mail className="mr-2 h-3.5 w-3.5" />
                Update email
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPasswordOpen(true)}
                className="shadow-e1"
              >
                <Lock className="mr-2 h-3.5 w-3.5" />
                Change password
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
              Role
            </Label>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-card shadow-e1 bg-background text-sm capitalize">
              {role || "Member"}
            </div>
            <p className="text-xs text-muted-foreground">
              Your role is managed by organisation owners.
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving || !hasProfileChanges}
            className="shadow-e1 bg-primary hover:bg-primary/90"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Profile
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {isExternal && (
        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Company Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              As an external {role}, your profile is linked to your company. Keep your company
              details up-to-date so property managers can verify your credentials.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/vendor/profile">
                <Button variant="outline" className="shadow-e1 gap-2">
                  <ExternalLink className="h-4 w-4" />
                  View Company Profile
                </Button>
              </Link>
              <Link to="/manage/vendors">
                <Button variant="outline" className="shadow-e1 gap-2">
                  <FileText className="h-4 w-4" />
                  Company Documents
                </Button>
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload insurance certificates, licences, and compliance documents via Company Documents.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Change password modal */}
      <Dialog open={passwordOpen} onOpenChange={handlePasswordDialogChange}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Change password
            </DialogTitle>
            <DialogDescription>
              Choose a strong password you don&apos;t use elsewhere. Minimum{" "}
              {MIN_PASSWORD_LENGTH} characters.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <PasswordField
              id="profile-current-password"
              label="Current password"
              value={currentPassword}
              onChange={setCurrentPassword}
              disabled={changingPassword}
              autoComplete="current-password"
            />
            <PasswordField
              id="profile-new-password"
              label="New password"
              value={newPassword}
              onChange={setNewPassword}
              disabled={changingPassword}
              autoComplete="new-password"
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            />
            <PasswordField
              id="profile-confirm-password"
              label="Confirm new password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              disabled={changingPassword}
              autoComplete="new-password"
            />
            {passwordError ? (
              <p className="text-sm text-destructive">{passwordError}</p>
            ) : null}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => handlePasswordDialogChange(false)}
                disabled={changingPassword}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  changingPassword ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword
                }
                className="bg-primary hover:bg-primary/90"
              >
                {changingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating…
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Update password
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm email change modal */}
      <Dialog
        open={emailDialogOpen}
        onOpenChange={(open) => {
          setEmailDialogOpen(open);
          if (!open) {
            setEmailConfirmPassword("");
            setEmailError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Update email
            </DialogTitle>
            <DialogDescription>
              We&apos;ll send a verification link to{" "}
              <span className="font-medium text-foreground">{editEmail.trim()}</span>.
              Confirm it to finish changing your email
              {userEmail ? (
                <>
                  {" "}
                  from <span className="font-medium text-foreground">{userEmail}</span>
                </>
              ) : null}
              .
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateEmail} className="space-y-4">
            <PasswordField
              id="profile-email-confirm-password"
              label="Current password"
              value={emailConfirmPassword}
              onChange={setEmailConfirmPassword}
              disabled={updatingEmail}
              autoComplete="current-password"
            />
            {emailError ? <p className="text-sm text-destructive">{emailError}</p> : null}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEmailDialogOpen(false)}
                disabled={updatingEmail}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updatingEmail || !emailConfirmPassword}
                className="bg-primary hover:bg-primary/90"
              >
                {updatingEmail ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  "Send verification"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
