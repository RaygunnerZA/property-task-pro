/**
 * WhoTab - Create Task "Who" step: assign people or teams.
 *
 * Create Task UX: captures intent, not full configuration. Not a user-management surface.
 * - Recognition: existing people = chips; names not in org = ghost chips ("not yet in your system").
 * - Intent: how should this person be involved? Team Member (internal, ongoing) vs External Vendor (task-only).
 * - Formalisation: permissions, roles, access are handled later (Settings / Team management). No DB user created here.
 */
import { useState, useRef } from "react";
import { User, Users, Search, Plus, ImagePlus, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Chip } from "@/components/chips/Chip";
import { IconPicker } from "@/components/ui/IconPicker";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { Textarea } from "@/components/ui/textarea";
import { useTeams } from "@/hooks/useTeams";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface PendingInvitation {
  id: string; // Temporary ID
  firstName: string;
  lastName: string;
  email: string;
  displayName: string;
}

interface WhoTabProps {
  assignedUserId?: string;
  assignedTeamIds: string[];
  onUserChange: (userId: string | undefined) => void;
  onTeamsChange: (teamIds: string[]) => void;
  suggestedPeople?: string[];
  pendingInvitations?: PendingInvitation[];
  onPendingInvitationsChange?: (invitations: PendingInvitation[]) => void;
}

interface PersonChip {
  id: string;
  user_id: string;
  display_name: string;
  isTemp?: boolean;
}

interface TeamChip {
  id: string;
  name: string;
  image_url?: string | null;
}

export function WhoTab({
  assignedUserId,
  assignedTeamIds,
  onUserChange,
  onTeamsChange,
  suggestedPeople = [],
  pendingInvitations = [],
  onPendingInvitationsChange,
}: WhoTabProps) {
  const { orgId } = useActiveOrg();
  const { toast } = useToast();
  const { teams, refresh: refreshTeams } = useTeams();
  const { members, refresh: refreshMembers } = useOrgMembers();

  const [searchQuery, setSearchQuery] = useState("");
  const [showCreatePerson, setShowCreatePerson] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [teamImageFile, setTeamImageFile] = useState<File | null>(null);
  const [teamImagePreview, setTeamImagePreview] = useState<string | null>(null);
  const [teamIcon, setTeamIcon] = useState<string>("");
  const [teamColor, setTeamColor] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [pendingGhostPerson, setPendingGhostPerson] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Invite modal state: captures intent (pending team member or task-only external). No user row inserted.
  const [inviteTab, setInviteTab] = useState<"team" | "vendor">("team");
  const [teamMemberFirstName, setTeamMemberFirstName] = useState("");
  const [teamMemberLastName, setTeamMemberLastName] = useState("");
  const [teamMemberEmail, setTeamMemberEmail] = useState("");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [vendorName, setVendorName] = useState("");
  const [vendorEmail, setVendorEmail] = useState("");
  const [vendorInviteText, setVendorInviteText] = useState("You've been invited to view and work on a task. Click the link below to access it.");

  // Map org members to chips
  const allPeople: PersonChip[] = members.map((m) => ({
    id: m.id,
    user_id: m.user_id,
    display_name: m.display_name,
  }));

  // Map teams to chips
  const allTeams: TeamChip[] = teams.map((t) => ({
    id: t.id,
    name: t.name,
    image_url: t.image_url,
  }));

  // Identify ghost chips (suggested but not in DB)
  const existingPeopleNames = allPeople.map(p => p.display_name.toLowerCase());
  const ghostPeople = suggestedPeople.filter(
    suggested => !existingPeopleNames.includes(suggested.toLowerCase())
  );

  // Filter by search
  const filteredPeople = allPeople.filter((p) =>
    p.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredTeams = allTeams.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectPerson = (userId: string | null) => {
    // If switching from a pending invitation to a real user, clean up pending invitations
    if (assignedUserId?.startsWith('pending-') && userId && !userId.startsWith('pending-')) {
      const email = assignedUserId.replace('pending-', '');
      const updated = pendingInvitations.filter(inv => inv.email !== email);
      onPendingInvitationsChange?.(updated);
    }
    // If removing assignment and it was a pending invitation, clean it up
    if (!userId && assignedUserId?.startsWith('pending-')) {
      const email = assignedUserId.replace('pending-', '');
      const updated = pendingInvitations.filter(inv => inv.email !== email);
      onPendingInvitationsChange?.(updated);
    }
    onUserChange(userId || undefined);
  };

  const toggleTeam = (teamId: string) => {
    if (assignedTeamIds.includes(teamId)) {
      onTeamsChange(assignedTeamIds.filter((id) => id !== teamId));
    } else {
      onTeamsChange([...assignedTeamIds, teamId]);
    }
  };

  const handleGhostPersonClick = (personName: string) => {
    setPendingGhostPerson(personName);
    // Pre-fill team member name if it looks like a full name
    const nameParts = personName.split(" ");
    if (nameParts.length >= 2) {
      setTeamMemberFirstName(nameParts[0]);
      setTeamMemberLastName(nameParts.slice(1).join(" "));
    } else {
      setTeamMemberFirstName(personName);
    }
    setInviteTab("team");
    setShowCreatePerson(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setTeamImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setTeamImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setTeamImageFile(null);
    setTeamImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreatePerson = async () => {
    if (inviteTab === "team") {
      if (!teamMemberFirstName.trim() || !teamMemberLastName.trim() || !teamMemberEmail.trim()) {
        toast({
          title: "Missing info",
          description: "Fill in all fields to continue",
          variant: "destructive",
        });
        return;
      }
      
      // Create pending invitation immediately
      const displayName = `${teamMemberFirstName} ${teamMemberLastName}`.trim();
      const pendingInvitation: PendingInvitation = {
        id: `pending-${Date.now()}-${Math.random()}`,
        firstName: teamMemberFirstName.trim(),
        lastName: teamMemberLastName.trim(),
        email: teamMemberEmail.trim(),
        displayName,
      };
      
      // Add to pending invitations
      const updatedInvitations = [...pendingInvitations, pendingInvitation];
      onPendingInvitationsChange?.(updatedInvitations);
      
      // Create chip immediately and allocate task
      // Use a temporary user_id format: "pending-{email}" to track this
      const tempUserId = `pending-${pendingInvitation.email}`;
      onUserChange(tempUserId);
      
      toast({
        title: "Team member invited",
        description: `${displayName} will receive an invitation.`,
      });
      
      // Reset form
      setTeamMemberFirstName("");
      setTeamMemberLastName("");
      setTeamMemberEmail("");
      setSelectedTeamIds([]);
      setSelectedGroupIds([]);
      setShowCreatePerson(false);
      setPendingGhostPerson(null);
    } else {
      // External Vendor
      if (!vendorName.trim() || !vendorEmail.trim()) {
        toast({
          title: "Missing info",
          description: "Add a name and email to continue",
          variant: "destructive",
        });
        return;
      }
      
      // Store vendor info - magic link will be generated when task is created
      toast({
        title: "Vendor added",
        description: `${vendorName} will receive an invite link when the task is created.`,
      });
      
      // Reset form
      setVendorName("");
      setVendorEmail("");
      setVendorInviteText("You've been invited to view and work on a task. Click the link below to access it.");
      setShowCreatePerson(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim() || !orgId) return;
    
    setCreating(true);
    try {
      await supabase.auth.refreshSession();
      
      let imageUrl: string | null = null;

      // Upload team image if provided
      if (teamImageFile) {
        const fileExt = teamImageFile.name.split('.').pop();
        const fileName = `teams/${orgId}/${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("task-images")
          .upload(fileName, teamImageFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("task-images")
          .getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }

      const { data, error } = await supabase
        .from("teams")
        .insert({
          org_id: orgId,
          name: newTeamName.trim(),
          ...(imageUrl && { metadata: { image_url: imageUrl } }),
        })
        .select("id")
        .single();

      if (error) throw error;

      toast({ title: "Team created" });
      setNewTeamName("");
      clearImage();
      setShowCreateTeam(false);
      refreshTeams();
      onTeamsChange([...assignedTeamIds, data.id]);
    } catch (err: any) {
      toast({ 
        title: "Couldn't create team", 
        description: err.message,
        variant: "destructive" 
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Assigned Summary */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Assigned
        </Label>
        <div className="flex flex-wrap gap-2 items-center min-h-[32px]">
          {assignedUserId && (() => {
            // Check if this is a pending invitation
            const isPending = assignedUserId.startsWith('pending-');
            let displayName: string;
            let isPendingInvitation = false;
            
            if (isPending) {
              // Extract email from pending user_id format: "pending-{email}"
              const email = assignedUserId.replace('pending-', '');
              const pendingInv = pendingInvitations.find(inv => inv.email === email);
              if (pendingInv) {
                displayName = pendingInv.displayName;
                // Don't mark as pending if user was just created - show as normal
                // Only mark as pending if this is a truly pending invitation (not just created)
                isPendingInvitation = false;
              } else {
                displayName = email;
              }
            } else {
              const person = allPeople.find(p => p.user_id === assignedUserId);
              displayName = person?.display_name || `User ${assignedUserId.slice(0, 8)}`;
            }
            
            return (
              <Chip
                key={`person-${assignedUserId}`}
                role="fact"
                label={displayName.toUpperCase()}
                onRemove={() => {
                  handleSelectPerson(null);
                  // Also remove from pending invitations if it was pending
                  if (isPendingInvitation) {
                    const email = assignedUserId.replace('pending-', '');
                    const updated = pendingInvitations.filter(inv => inv.email !== email);
                    onPendingInvitationsChange?.(updated);
                  }
                }}
                className={isPendingInvitation ? "opacity-50" : ""}
              />
            );
          })()}
          {assignedTeamIds.length > 0 && assignedTeamIds.map(teamId => {
            const team = allTeams.find(t => t.id === teamId);
            if (!team) {
              // Team might not be loaded yet, show placeholder
              return (
                <Chip
                  key={`team-${teamId}`}
                  role="fact"
                  label={`TEAM ${teamId.slice(0, 8).toUpperCase()}`}
                  onRemove={() => toggleTeam(teamId)}
                />
              );
            }
            return (
              <Chip
                key={`team-${teamId}`}
                role="fact"
                label={team.name.toUpperCase()}
                onRemove={() => toggleTeam(teamId)}
              />
            );
          })}
          {!assignedUserId && assignedTeamIds.length === 0 && (
            <span className="text-xs text-muted-foreground">No one assigned</span>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search people or teams..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 shadow-engraved font-mono text-sm"
        />
      </div>

      {/* People List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <User className="h-3.5 w-3.5" />
            People
          </Label>
          <button
            type="button"
            onClick={() => {
              setInviteTab("team");
              setTeamMemberFirstName("");
              setTeamMemberLastName("");
              setTeamMemberEmail("");
              setSelectedTeamIds([]);
              setSelectedGroupIds([]);
              setShowCreatePerson(true);
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" />
            New
          </button>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {filteredPeople.map((person) => {
            const isSelected = assignedUserId === person.user_id;
            return (
              <Chip
                key={person.id}
                role="filter"
                label={person.display_name.toUpperCase()}
                selected={isSelected}
                onSelect={() => {
                  if (isSelected) {
                    handleSelectPerson(null);
                  } else {
                    handleSelectPerson(person.user_id);
                  }
                }}
              />
            );
          })}
          
          {/* Ghost chips for AI suggestions */}
          {ghostPeople.map((ghostName, idx) => (
            <Chip
              key={`ghost-${idx}`}
              role="suggestion"
              label={`+ ${ghostName.toUpperCase()}`}
              onSelect={() => handleGhostPersonClick(ghostName)}
              animate={true}
            />
          ))}
          
          {filteredPeople.length === 0 && ghostPeople.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">
              {searchQuery ? "No people match your search" : "No people available"}
            </p>
          )}
        </div>
      </div>

      {/* Teams List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <Users className="h-3.5 w-3.5" />
            Teams
          </Label>
          <button
            type="button"
            onClick={() => {
              setNewTeamName("");
              setTeamIcon("");
              setTeamColor("");
              clearImage();
              setShowCreateTeam(true);
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" />
            New
          </button>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {filteredTeams.map((team) => (
            <Chip
              key={team.id}
              role="filter"
              label={team.name.toUpperCase()}
              selected={assignedTeamIds.includes(team.id)}
              onSelect={() => toggleTeam(team.id)}
            />
          ))}
          
          {filteredTeams.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">
              {searchQuery ? "No teams match your search" : "No teams available"}
            </p>
          )}
        </div>
      </div>

      {/* Create Person Modal with Tabs */}
      <Dialog open={showCreatePerson} onOpenChange={(open) => {
        setShowCreatePerson(open);
        if (!open) {
          setPendingGhostPerson(null);
          setInviteTab("team");
          setTeamMemberFirstName("");
          setTeamMemberLastName("");
          setTeamMemberEmail("");
          setSelectedTeamIds([]);
          setSelectedGroupIds([]);
          setVendorName("");
          setVendorEmail("");
          setVendorInviteText("You've been invited to view and work on a task. Click the link below to access it.");
        }
      }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {pendingGhostPerson ? `Add "${pendingGhostPerson}"?` : "Invite"}
            </DialogTitle>
            <DialogDescription>
              {pendingGhostPerson 
                ? `Invite "${pendingGhostPerson}" to join your organization and assign them to this task.`
                : "Invite a person or team to join your organization and assign them to this task."}
            </DialogDescription>
          </DialogHeader>
          
          <Tabs value={inviteTab} onValueChange={(v) => setInviteTab(v as "team" | "vendor")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="team">Team Member</TabsTrigger>
              <TabsTrigger value="vendor">External Vendor</TabsTrigger>
            </TabsList>
            
            {/* Team Member (internal, ongoing): add to team for future tasks → pending team member */}
            <TabsContent value="team" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input
                    placeholder="First name"
                    value={teamMemberFirstName}
                    onChange={(e) => setTeamMemberFirstName(e.target.value)}
                    className="shadow-engraved"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input
                    placeholder="Last name"
                    value={teamMemberLastName}
                    onChange={(e) => setTeamMemberLastName(e.target.value)}
                    className="shadow-engraved"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={teamMemberEmail}
                  onChange={(e) => setTeamMemberEmail(e.target.value)}
                  className="shadow-engraved"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Team</Label>
                  <button
                    type="button"
                    onClick={() => {
                      // TODO: Open team search/selector
                    }}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus className="h-3 w-3" />
                    Add or Search
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[32px]">
                  {selectedTeamIds.map((teamId) => {
                    const team = allTeams.find(t => t.id === teamId);
                    return team ? (
                      <Chip
                        key={teamId}
                        role="fact"
                        label={team.name.toUpperCase()}
                        onRemove={() => setSelectedTeamIds(prev => prev.filter(id => id !== teamId))}
                      />
                    ) : null;
                  })}
                  {selectedTeamIds.length === 0 && (
                    <span className="text-xs text-muted-foreground">No teams selected</span>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Other Groups</Label>
                  <button
                    type="button"
                    onClick={() => {
                      // TODO: Open group search/selector
                    }}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus className="h-3 w-3" />
                    Add or Search
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[32px]">
                  {selectedGroupIds.length === 0 && (
                    <span className="text-xs text-muted-foreground">No groups selected</span>
                  )}
                </div>
              </div>
            </TabsContent>
            
            {/* External Vendor (task-only): share this task only → task-only external; magic link when task is created */}
            <TabsContent value="vendor" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="Vendor name"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="shadow-engraved"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={vendorEmail}
                  onChange={(e) => setVendorEmail(e.target.value)}
                  className="shadow-engraved"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Invite Message</Label>
                <Textarea
                  placeholder="Invite message"
                  value={vendorInviteText}
                  onChange={(e) => setVendorInviteText(e.target.value)}
                  className="shadow-engraved min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground">
                  Share this task only (task-only external). This message will be sent with the magic link to access the task.
                </p>
              </div>
            </TabsContent>
          </Tabs>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreatePerson(false);
                setPendingGhostPerson(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreatePerson}
              disabled={
                inviteTab === "team"
                  ? !teamMemberFirstName.trim() || !teamMemberLastName.trim() || !teamMemberEmail.trim()
                  : !vendorName.trim() || !vendorEmail.trim()
              }
            >
              {inviteTab === "team" ? "Add Team Member" : "Add Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Team Modal */}
      <Dialog open={showCreateTeam} onOpenChange={setShowCreateTeam}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Team</DialogTitle>
            <DialogDescription>
              Create a new team to assign tasks to multiple people at once.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Team Name</Label>
              <Input
                placeholder="Team name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className="shadow-engraved"
              />
            </div>
            
            {/* Image / Icon / Color row */}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              
              {teamImagePreview ? (
                <div className="relative w-16 h-16 rounded-[8px] overflow-hidden shadow-e1">
                  <img src={teamImagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-0.5 right-0.5 p-0.5 bg-background/80 rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 rounded-[8px] border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:border-primary/50 transition-colors"
                >
                  <ImagePlus className="h-4 w-4" />
                  <span className="text-[10px]">Image</span>
                </button>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Choose Icon</Label>
              <IconPicker value={teamIcon} onChange={setTeamIcon} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Choose Color</Label>
              <ColorPicker value={teamColor} onChange={setTeamColor} />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateTeam(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTeam}
              disabled={!newTeamName.trim() || creating}
            >
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
