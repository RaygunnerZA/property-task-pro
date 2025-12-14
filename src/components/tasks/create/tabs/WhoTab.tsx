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
  DialogFooter,
} from "@/components/ui/dialog";
import { StandardChip } from "@/components/chips/StandardChip";
import { IconPicker } from "@/components/ui/IconPicker";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { useTeams } from "@/hooks/useTeams";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useDataContext } from "@/contexts/DataContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WhoTabProps {
  assignedUserId?: string;
  assignedTeamIds: string[];
  onUserChange: (userId: string | undefined) => void;
  onTeamsChange: (teamIds: string[]) => void;
  suggestedPeople?: string[];
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
}: WhoTabProps) {
  const { orgId } = useDataContext();
  const { toast } = useToast();
  const { teams, refresh: refreshTeams } = useTeams(orgId);
  const { members, refresh: refreshMembers } = useOrgMembers();

  const [searchQuery, setSearchQuery] = useState("");
  const [showCreatePerson, setShowCreatePerson] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [teamImageFile, setTeamImageFile] = useState<File | null>(null);
  const [teamImagePreview, setTeamImagePreview] = useState<string | null>(null);
  const [teamIcon, setTeamIcon] = useState<string>("");
  const [teamColor, setTeamColor] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [pendingGhostPerson, setPendingGhostPerson] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setNewPersonName(personName);
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
    if (!newPersonName.trim()) return;
    
    // For now, create a placeholder (real person creation requires invite flow)
    toast({
      title: "Person noted",
      description: `${newPersonName} will be invited when you send an invite.`,
    });
    
    setNewPersonName("");
    setPendingGhostPerson(null);
    setShowCreatePerson(false);
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
          image_url: imageUrl,
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
        title: "Error creating team", 
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
          {assignedUserId && (
            <StandardChip
              label={allPeople.find(p => p.user_id === assignedUserId)?.display_name || "Unknown"}
              selected
              onSelect={() => handleSelectPerson(null)}
              onRemove={() => handleSelectPerson(null)}
            />
          )}
          {assignedTeamIds.map(teamId => {
            const team = allTeams.find(t => t.id === teamId);
            return team ? (
              <StandardChip
                key={teamId}
                label={team.name}
                selected
                onSelect={() => toggleTeam(teamId)}
                onRemove={() => toggleTeam(teamId)}
              />
            ) : null;
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
              setNewPersonName("");
              setShowCreatePerson(true);
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-3 w-3" />
            New
          </button>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {filteredPeople.map((person) => (
            <StandardChip
              key={person.id}
              label={person.display_name}
              selected={assignedUserId === person.user_id}
              onSelect={() =>
                handleSelectPerson(
                  assignedUserId === person.user_id ? null : person.user_id
                )
              }
            />
          ))}
          
          {/* Ghost chips for AI suggestions */}
          {ghostPeople.map((ghostName, idx) => (
            <StandardChip
              key={`ghost-${idx}`}
              label={`+ ${ghostName}`}
              ghost
              onSelect={() => handleGhostPersonClick(ghostName)}
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
            <StandardChip
              key={team.id}
              label={team.name}
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

      {/* Create Person Modal */}
      <Dialog open={showCreatePerson} onOpenChange={(open) => {
        setShowCreatePerson(open);
        if (!open) setPendingGhostPerson(null);
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {pendingGhostPerson ? `Add "${pendingGhostPerson}"?` : "Add Person"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="Person name"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                className="shadow-engraved"
              />
            </div>
            {pendingGhostPerson && (
              <p className="text-xs text-muted-foreground">
                This person doesn't exist yet. They'll be added when you invite them.
              </p>
            )}
          </div>
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
              disabled={!newPersonName.trim()}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Team Modal */}
      <Dialog open={showCreateTeam} onOpenChange={setShowCreateTeam}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Team</DialogTitle>
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
                <div className="relative w-16 h-16 rounded-[5px] overflow-hidden border border-border">
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
                  className="w-16 h-16 rounded-[5px] border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:border-primary/50 transition-colors"
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
