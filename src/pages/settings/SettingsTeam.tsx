import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { Loader2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { supabase } from "@/integrations/supabase/client";

export default function SettingsTeam() {
  const { members, loading, error, refresh } = useOrgMembers();
  const { orgId } = useActiveOrg();
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  const handleInviteMember = () => {
    setInviteModalOpen(true);
  };

  const handleSendInvite = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (!orgId) {
      toast.error("Organization not found");
      return;
    }

    setInviteLoading(true);
    try {
      // TODO: Implement actual invite logic (send email, create invitation record, etc.)
      // For now, just show success
      toast.success(`Invitation sent to ${email}`);
      setInviteModalOpen(false);
      setFirstName("");
      setLastName("");
      setEmail("");
      // Refresh members list after invite
      await refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to send invitation");
    } finally {
      setInviteLoading(false);
    }
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
            <Button onClick={handleInviteMember} size="sm">
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
      </div>

      {/* Invite Member Modal */}
      <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to add a new member to your organization.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={inviteLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={inviteLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="john.doe@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={inviteLoading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setInviteModalOpen(false);
                setFirstName("");
                setLastName("");
                setEmail("");
              }}
              disabled={inviteLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleSendInvite} disabled={inviteLoading}>
              {inviteLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Invitation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

