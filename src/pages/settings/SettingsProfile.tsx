import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
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
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const AVATAR_COLORS = [
  "#8EC9CE", "#EB6834", "#6B8E9B", "#D4A373",
  "#A78BFA", "#F472B6", "#34D399", "#FBBF24",
];

export default function SettingsProfile() {
  const { orgId } = useActiveOrg();
  const { role, isLoading: roleLoading } = useCurrentUserRole();

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);

  const [editNickname, setEditNickname] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  const isExternal = role === "contractor" || role === "vendor" || role === "inspector";

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setUserEmail(user.email || "");
        setNickname(user.user_metadata?.nickname || "");
        setEditNickname(user.user_metadata?.nickname || "");
        setAvatarUrl(user.user_metadata?.avatar_url || null);
        setAvatarColor(user.user_metadata?.avatar_color || AVATAR_COLORS[0]);
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    const nicknameChanged = editNickname !== nickname;
    const avatarChanged = !!avatarFile || avatarPreview !== null;
    setHasChanges(nicknameChanged || avatarChanged);
  }, [editNickname, nickname, avatarFile, avatarPreview]);

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
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarUrl(null);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);

    try {
      let newAvatarUrl = avatarUrl;

      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `avatars/${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        if (avatarUrl) {
          try {
            const oldFileName = avatarUrl.split("/").pop();
            if (oldFileName) {
              await supabase.storage.from("user-avatars").remove([`avatars/${userId}/${oldFileName}`]);
            }
          } catch {
            // non-critical
          }
        }

        const { error: uploadError } = await supabase.storage
          .from("user-avatars")
          .upload(fileName, avatarFile, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("user-avatars")
          .getPublicUrl(fileName);
        newAvatarUrl = publicUrl;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          nickname: editNickname.trim() || null,
          avatar_url: newAvatarUrl,
        },
      });
      if (updateError) throw updateError;

      toast.success("Profile updated");
      await supabase.auth.refreshSession();
      setNickname(editNickname.trim());
      setAvatarUrl(newAvatarUrl);
      setAvatarFile(null);
      setAvatarPreview(null);
      setHasChanges(false);
    } catch (err: any) {
      console.error("Error updating profile:", err);
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
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

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Card className="shadow-e1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            Your Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex w-full min-w-0 flex-col items-stretch gap-5 sm:flex-row sm:items-center">
            <div className="relative group shrink-0">
              <Avatar className="h-20 w-20 shadow-e1">
                {avatarPreview || avatarUrl ? (
                  <AvatarImage src={avatarPreview || avatarUrl || undefined} />
                ) : (
                  <AvatarFallback
                    className="text-lg font-semibold text-white"
                    style={{ backgroundColor: avatarColor }}
                  >
                    {initials}
                  </AvatarFallback>
                )}
              </Avatar>
              {(avatarPreview || avatarUrl) && (
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
                      setAvatarUrl(null);
                      setAvatarFile(null);
                      setAvatarPreview(null);
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

          {/* Nickname */}
          <div className="space-y-1.5">
            <Label htmlFor="profile-nickname" className="text-sm">Display Name</Label>
            <Input
              id="profile-nickname"
              value={editNickname}
              onChange={(e) => setEditNickname(e.target.value)}
              placeholder="Your name or nickname"
              disabled={saving}
              className="w-full max-w-full shadow-engraved border-0 sm:max-w-sm"
            />
          </div>

          {/* Email (read-only) */}
          <div className="space-y-1.5">
            <Label className="text-sm flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              Email
            </Label>
            <Input
              value={userEmail}
              disabled
              className="w-full max-w-full bg-muted sm:max-w-sm"
            />
            <p className="text-xs text-muted-foreground">
              Email changes require re-authentication. Contact support to update.
            </p>
          </div>

          {/* Role badge */}
          <div className="space-y-1.5">
            <Label className="text-sm flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
              Role
            </Label>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px] shadow-e1 bg-background text-sm capitalize">
              {role || "Member"}
            </div>
            <p className="text-xs text-muted-foreground">
              Your role is managed by organisation owners.
            </p>
          </div>

          {/* Save button */}
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="shadow-e1 bg-primary hover:bg-primary/90"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
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

      {/* Vendor/Contractor Company Profile link */}
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
    </div>
  );
}
