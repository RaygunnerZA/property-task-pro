import React, { useState } from "react";
import { UserPlus, Users, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDataContext } from "@/contexts/DataContext";
import { useSupabase } from "@/integrations/supabase/useSupabase";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type MenuView = "main" | "create-person" | "create-team";

interface NewAssigneeMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPersonCreated?: (person: { id: string; display_name: string }) => void;
  onTeamCreated?: (teamId: string) => void;
}

/**
 * NewAssigneeMenu - Action sheet for creating new assignees
 * Options: Create Person, Create Team, Invite to Organisation
 */
export function NewAssigneeMenu({
  open,
  onOpenChange,
  onPersonCreated,
  onTeamCreated,
}: NewAssigneeMenuProps) {
  const isMobile = useIsMobile();
  const { orgId } = useDataContext();
  const supabase = useSupabase();
  const { toast } = useToast();

  const [view, setView] = useState<MenuView>("main");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Person form state (UI-only placeholder)
  const [personName, setPersonName] = useState("");
  const [personEmail, setPersonEmail] = useState("");

  // Team form state
  const [teamName, setTeamName] = useState("");

  const resetAndClose = () => {
    setView("main");
    setPersonName("");
    setPersonEmail("");
    setTeamName("");
    onOpenChange(false);
  };

  const handleCreatePerson = () => {
    if (!personName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name.",
        variant: "destructive",
      });
      return;
    }

    // UI-only: create a temporary local person
    const tempPerson = {
      id: `temp-${Date.now()}`,
      display_name: personName.trim(),
    };

    onPersonCreated?.(tempPerson);
    toast({
      title: "Person added",
      description: `${personName} added (invite pending).`,
    });
    resetAndClose();
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      toast({
        title: "Team name required",
        description: "Please enter a team name.",
        variant: "destructive",
      });
      return;
    }

    if (!orgId) {
      toast({
        title: "Not authenticated",
        description: "Please log in.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Refresh session for RLS
      await supabase.auth.refreshSession();

      const { data, error } = await supabase
        .from("teams")
        .insert({
          org_id: orgId,
          name: teamName.trim(),
        })
        .select("id")
        .single();

      if (error) throw error;

      onTeamCreated?.(data.id);
      toast({
        title: "Team created",
        description: `${teamName} has been created.`,
      });
      resetAndClose();
    } catch (error: any) {
      toast({
        title: "Error creating team",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const mainMenuContent = (
    <div className="flex flex-col gap-2 p-4">
      <button
        type="button"
        onClick={() => setView("create-person")}
        className={cn(
          "flex items-center gap-3 p-4 rounded-lg",
          "bg-card shadow-e1 hover:shadow-e2",
          "transition-all duration-150",
          "text-left"
        )}
      >
        <div className="p-2 rounded-lg bg-primary/10">
          <UserPlus className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-medium text-sm">Create New Person</p>
          <p className="text-xs text-muted-foreground">Add to this task</p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => setView("create-team")}
        className={cn(
          "flex items-center gap-3 p-4 rounded-lg",
          "bg-card shadow-e1 hover:shadow-e2",
          "transition-all duration-150",
          "text-left"
        )}
      >
        <div className="p-2 rounded-lg bg-accent/10">
          <Users className="h-5 w-5 text-accent" />
        </div>
        <div>
          <p className="font-medium text-sm">Create New Team</p>
          <p className="text-xs text-muted-foreground">Add a team to your org</p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => {
          toast({
            title: "Coming soon",
            description: "Invite flow will be available soon.",
          });
        }}
        className={cn(
          "flex items-center gap-3 p-4 rounded-lg",
          "bg-card shadow-e1 hover:shadow-e2",
          "transition-all duration-150",
          "text-left"
        )}
      >
        <div className="p-2 rounded-lg bg-muted">
          <Mail className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium text-sm">Invite to Organisation</p>
          <p className="text-xs text-muted-foreground">Send an email invite</p>
        </div>
      </button>

      <Button
        variant="ghost"
        className="mt-2"
        onClick={resetAndClose}
      >
        Cancel
      </Button>
    </div>
  );

  const createPersonContent = (
    <div className="flex flex-col gap-4 p-4">
      <div className="space-y-2">
        <Label htmlFor="person-name" className="text-sm font-medium">
          Name *
        </Label>
        <Input
          id="person-name"
          value={personName}
          onChange={(e) => setPersonName(e.target.value)}
          placeholder="Enter name"
          className="shadow-engraved"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="person-email" className="text-sm font-medium">
          Email (optional)
        </Label>
        <Input
          id="person-email"
          type="email"
          value={personEmail}
          onChange={(e) => setPersonEmail(e.target.value)}
          placeholder="Enter email"
          className="shadow-engraved"
        />
      </div>

      <div className="flex gap-3 mt-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => setView("main")}
        >
          Back
        </Button>
        <Button className="flex-1" onClick={handleCreatePerson}>
          Add Person
        </Button>
      </div>
    </div>
  );

  const createTeamContent = (
    <div className="flex flex-col gap-4 p-4">
      <div className="space-y-2">
        <Label htmlFor="team-name" className="text-sm font-medium">
          Team Name *
        </Label>
        <Input
          id="team-name"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="Enter team name"
          className="shadow-engraved"
        />
      </div>

      <div className="flex gap-3 mt-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => setView("main")}
          disabled={isSubmitting}
        >
          Back
        </Button>
        <Button
          className="flex-1"
          onClick={handleCreateTeam}
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating..." : "Create Team"}
        </Button>
      </div>
    </div>
  );

  const getTitle = () => {
    switch (view) {
      case "create-person":
        return "Add Person";
      case "create-team":
        return "Create Team";
      default:
        return "Add Assignee";
    }
  };

  const getContent = () => {
    switch (view) {
      case "create-person":
        return createPersonContent;
      case "create-team":
        return createTeamContent;
      default:
        return mainMenuContent;
    }
  };

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="border-b border-border">
            <DrawerTitle>{getTitle()}</DrawerTitle>
          </DrawerHeader>
          {getContent()}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0">
        <DialogHeader className="p-4 border-b border-border">
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>
        {getContent()}
      </DialogContent>
    </Dialog>
  );
}
