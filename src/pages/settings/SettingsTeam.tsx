import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { Loader2, UserPlus, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function SettingsTeam() {
  const { members, loading, error } = useOrgMembers();

  const handleInviteMember = () => {
    // UI only for now - will be implemented later
    console.log("Invite member clicked");
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
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        {member.display_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {member.user_id.slice(0, 8)}...
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
  );
}

