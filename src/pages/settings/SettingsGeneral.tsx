import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/hooks/use-organization";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, Plus, User as UserIcon, Edit, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function SettingsGeneral() {
  const { organization, loading, error, updateName, refresh } = useOrganization();
  const { orgId, isLoading: orgLoading, error: orgError, refresh: refreshActiveOrg } = useActiveOrg();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const { toast: toastHook } = useToast();

  // User profile state for display
  const [userEmail, setUserEmail] = useState("");
  const [userNickname, setUserNickname] = useState("");
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Edit profile modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingNickname, setEditingNickname] = useState("");
  const [editingEmail, setEditingEmail] = useState("");
  const [editingAvatarUrl, setEditingAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Initialize name from organization when loaded
  useEffect(() => {
    if (organization?.name) {
      setName(organization.name);
    }
  }, [organization?.name]);

  // Load user profile data for display
  useEffect(() => {
    async function loadUserProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || "");
        setUserNickname(user.user_metadata?.nickname || "");
        setUserAvatarUrl(user.user_metadata?.avatar_url || null);
        setUserId(user.id);
      }
    }
    
    loadUserProfile();
    
    // Listen for auth state changes to update profile display
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserEmail(session.user.email || "");
        setUserNickname(session.user.user_metadata?.nickname || "");
        setUserAvatarUrl(session.user.user_metadata?.avatar_url || null);
        setUserId(session.user.id);
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleEditProfile = () => {
    setEditingNickname(userNickname);
    setEditingEmail(userEmail);
    setEditingAvatarUrl(userAvatarUrl);
    setAvatarFile(null);
    setAvatarPreview(null);
    setEditModalOpen(true);
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error("Please select an image file");
        return;
      }
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size must be less than 5MB");
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview(null);
    setEditingAvatarUrl(null);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = "";
    }
  };

  const handleSaveProfile = async () => {
    if (!userId) {
      toast.error("User not found");
      return;
    }

    setSavingProfile(true);
    try {
      let newAvatarUrl = editingAvatarUrl;

      // Upload new avatar if selected
      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `avatars/${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        // Delete old avatar if exists
        if (editingAvatarUrl) {
          try {
            const oldFileName = editingAvatarUrl.split('/').pop();
            if (oldFileName) {
              await supabase.storage
                .from("user-avatars")
                .remove([`avatars/${userId}/${oldFileName}`]);
            }
          } catch (err) {
            console.warn("Failed to delete old avatar:", err);
          }
        }

        const { error: uploadError } = await supabase.storage
          .from("user-avatars")
          .upload(fileName, avatarFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("user-avatars")
          .getPublicUrl(fileName);
        
        newAvatarUrl = publicUrl;
      }

      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          nickname: editingNickname.trim() || null,
          avatar_url: newAvatarUrl,
        }
      });

      if (updateError) {
        throw updateError;
      }

      // Note: Email changes typically require re-authentication in Supabase
      // For now, we'll just update the metadata fields
      if (editingEmail !== userEmail) {
        toast.info("Email changes require re-authentication. Please use the account settings to change your email.");
      }

      toast.success("Profile updated successfully");
      setEditModalOpen(false);
      
      // Refresh user data
      await supabase.auth.refreshSession();
      
      // Update local state
      setUserNickname(editingNickname.trim() || "");
      setUserAvatarUrl(newAvatarUrl);
    } catch (err: any) {
      console.error("Error updating profile:", err);
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toastHook({
        title: "Error",
        description: "Organization name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      await updateName(name.trim());
      toastHook({
        title: "Success",
        description: "Organization name updated successfully",
      });
    } catch (err: any) {
      toastHook({
        title: "Error",
        description: err.message || "Failed to update organization name",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) {
      toast.error("Organization name is required");
      return;
    }

    setCreating(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        toast.error("Please sign in to continue");
        return;
      }

      const currentUserId = user.id;

      // Use the create_organisation RPC function
      const { data: orgId, error: orgError } = await supabase.rpc('create_organisation', {
        org_name: newOrgName.trim(),
        org_type_value: 'business',
        creator_id: currentUserId
      });

      if (orgError) {
        console.error("Org creation error:", orgError);
        toast.error(orgError.message || "Failed to create organization");
        return;
      }

      if (!orgId) {
        toast.error("Failed to create organization: no ID returned");
        return;
      }

      toast.success("Organization created successfully!");
      setNewOrgName("");
      
      // Refresh session and organization data
      await supabase.auth.refreshSession();
      await refreshActiveOrg();
      
      // Wait a moment for the database to be ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh the organization data
      await refresh();
    } catch (err: any) {
      console.error("Create org failed:", err);
      toast.error(err.message || "Failed to create organization");
    } finally {
      setCreating(false);
    }
  };

  if (loading || orgLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If user doesn't have an organization, show "Add Organisation" flow
  if (!orgId || !organization) {
    return (
      <>
        <div className="space-y-6">
          {/* User Profile Card - With Edit Button */}
          <Card className="shadow-e1">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={userAvatarUrl || undefined} />
                    <AvatarFallback>
                      <UserIcon className="h-8 w-8" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">
                      {userNickname || "User"}
                    </h2>
                    <p className="text-sm mt-0.5 text-muted-foreground">
                      {userEmail || "No email"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEditProfile}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </div>
            </CardContent>
          </Card>

        {/* Create Organisation Section */}
        <Card className="shadow-e1">
          <CardHeader>
            <CardTitle>Organization Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">
                You don't have an organization yet. Create one to get started.
              </p>
              <div className="space-y-4 max-w-md mx-auto">
                <div className="space-y-2">
                  <Label htmlFor="new-org-name">Organization Name</Label>
                  <Input
                    id="new-org-name"
                    value={newOrgName}
                    onChange={(e) => setNewOrgName(e.target.value)}
                    placeholder="Enter organization name"
                    disabled={creating}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !creating && newOrgName.trim()) {
                        handleCreateOrg();
                      }
                    }}
                  />
                </div>
                <Button
                  onClick={handleCreateOrg}
                  disabled={creating || !newOrgName.trim()}
                  className="w-full"
                >
                  {creating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Organization
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>

        {/* Edit Profile Dialog */}
        <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Profile</DialogTitle>
              <DialogDescription>
                Update your profile information and avatar.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              {/* Avatar Section */}
              <div className="flex flex-col items-center gap-4">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={avatarPreview || editingAvatarUrl || undefined} />
                  <AvatarFallback>
                    <UserIcon className="h-12 w-12" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {avatarPreview || editingAvatarUrl ? "Replace" : "Upload"}
                  </Button>
                  {(avatarPreview || editingAvatarUrl) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveAvatar}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  )}
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarSelect}
                  className="hidden"
                />
              </div>

              {/* Nickname */}
              <div className="grid gap-2">
                <Label htmlFor="nickname">Nickname</Label>
                <Input
                  id="nickname"
                  placeholder="Your display name"
                  value={editingNickname}
                  onChange={(e) => setEditingNickname(e.target.value)}
                  disabled={savingProfile}
                />
              </div>

              {/* Email (read-only with note) */}
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={editingEmail}
                  onChange={(e) => setEditingEmail(e.target.value)}
                  disabled={true}
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email changes require re-authentication. Contact support to change your email.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditModalOpen(false)}
                disabled={savingProfile}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
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
      <div className="space-y-6">
        {/* User Profile Card - With Edit Button */}
        <Card className="shadow-e1">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={userAvatarUrl || undefined} />
                  <AvatarFallback>
                    <UserIcon className="h-8 w-8" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    {userNickname || "User"}
                  </h2>
                  <p className="text-sm mt-0.5 text-muted-foreground">
                    {userEmail || "No email"}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEditProfile}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </div>
          </CardContent>
        </Card>

      {/* Organization Settings Section */}
      <Card className="shadow-e1">
        <CardHeader>
          <CardTitle>Organization Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter organization name"
              disabled={saving}
            />
          </div>
          <Button
            onClick={handleSave}
            disabled={saving || name === organization?.name}
            className="w-full sm:w-auto"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update your profile information and avatar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={avatarPreview || editingAvatarUrl || undefined} />
                <AvatarFallback>
                  <UserIcon className="h-12 w-12" />
                </AvatarFallback>
              </Avatar>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {avatarPreview || editingAvatarUrl ? "Replace" : "Upload"}
                </Button>
                {(avatarPreview || editingAvatarUrl) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemoveAvatar}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarSelect}
                className="hidden"
              />
            </div>

            {/* Nickname */}
            <div className="grid gap-2">
              <Label htmlFor="nickname">Nickname</Label>
              <Input
                id="nickname"
                placeholder="Your display name"
                value={editingNickname}
                onChange={(e) => setEditingNickname(e.target.value)}
                disabled={savingProfile}
              />
            </div>

            {/* Email (read-only with note) */}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={editingEmail}
                onChange={(e) => setEditingEmail(e.target.value)}
                disabled={true}
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email changes require re-authentication. Contact support to change your email.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditModalOpen(false)}
              disabled={savingProfile}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
