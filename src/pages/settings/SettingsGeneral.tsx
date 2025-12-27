import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/hooks/use-organization";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Save, Plus, User as UserIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

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
      }
    }
    
    loadUserProfile();
    
    // Listen for auth state changes to update profile display
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserEmail(session.user.email || "");
        setUserNickname(session.user.user_metadata?.nickname || "");
        setUserAvatarUrl(session.user.user_metadata?.avatar_url || null);
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

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
      <div className="space-y-6">
        {/* User Profile Card - Display Only */}
        <Card className="shadow-e1">
          <CardContent className="pt-6">
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
    <div className="space-y-6">
      {/* User Profile Card - Display Only */}
      <Card className="shadow-e1">
        <CardContent className="pt-6">
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
  );
}
