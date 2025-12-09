import { useState, useRef } from "react";
import { Folder, Plus, X, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useGroups } from "@/hooks/useGroups";
import { supabase } from "@/integrations/supabase/client";
import { useDataContext } from "@/contexts/DataContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface GroupsSectionProps {
  selectedGroupIds: string[];
  onGroupsChange: (groupIds: string[]) => void;
}

export function GroupsSection({ selectedGroupIds, onGroupsChange }: GroupsSectionProps) {
  const { groups, refresh } = useGroups();
  const { orgId } = useDataContext();
  const { toast } = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const toggleGroup = (groupId: string) => {
    if (selectedGroupIds.includes(groupId)) {
      onGroupsChange(selectedGroupIds.filter(id => id !== groupId));
    } else {
      onGroupsChange([...selectedGroupIds, groupId]);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      toast({ 
        title: "Name required", 
        description: "Please enter a group name.",
        variant: "destructive" 
      });
      return;
    }
    
    if (!orgId) {
      toast({ 
        title: "Not authenticated", 
        description: "Please log in to create groups.",
        variant: "destructive" 
      });
      return;
    }
    
    setCreating(true);
    try {
      let imageUrl: string | null = null;

      // Upload image to task-images bucket under groups/ folder
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `groups/${orgId}/${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("task-images")
          .upload(fileName, imageFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("task-images")
          .getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }

      // Refresh session to ensure JWT has latest org_id claim
      await supabase.auth.refreshSession();

      const { error } = await supabase
        .from("groups")
        .insert({
          org_id: orgId,
          name: newGroupName.trim(),
          image_url: imageUrl,
        });

      if (error) throw error;

      toast({ title: "Group created" });
      setNewGroupName("");
      clearImage();
      setShowCreateModal(false);
      refresh();
    } catch (err: any) {
      console.error("Group creation error:", err);
      toast({ 
        title: "Error creating group", 
        description: err.message,
        variant: "destructive" 
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Folder className="h-4 w-4 text-muted-foreground" />
          Groups
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowCreateModal(true)}
          className="h-7 px-2 text-xs gap-1"
        >
          <Plus className="h-3 w-3" />
          New
        </Button>
      </div>

      {groups.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {groups.map(group => (
            <Badge
              key={group.id}
              variant={selectedGroupIds.includes(group.id) ? "default" : "outline"}
              className={cn(
                "cursor-pointer font-mono text-xs uppercase transition-all gap-1",
                selectedGroupIds.includes(group.id) && "bg-primary text-primary-foreground"
              )}
              onClick={() => toggleGroup(group.id)}
              style={group.color ? { 
                backgroundColor: selectedGroupIds.includes(group.id) ? group.color : undefined,
                borderColor: group.color
              } : undefined}
            >
              {group.icon && <span>{group.icon}</span>}
              {group.display_name || group.name}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">
          No groups yet. Create one to organize tasks.
        </p>
      )}

      {/* Create Group Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="groupName">Group Name</Label>
              <Input
                id="groupName"
                placeholder="e.g., Fire Safety, Monthly Inspections"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="shadow-engraved mt-1.5"
              />
            </div>

            <div>
              <Label>Thumbnail Image</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              {imagePreview ? (
                <div className="relative mt-1.5 w-full h-32 rounded-[5px] overflow-hidden shadow-e1">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={clearImage}
                    className="absolute top-1 right-1 p-1 bg-background/80 rounded-full"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1.5 w-full h-24 rounded-[5px] border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 transition-colors"
                >
                  <ImagePlus className="h-6 w-6" />
                  <span className="text-xs">Add image</span>
                </button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateModal(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateGroup}
              disabled={!newGroupName.trim() || creating}
            >
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
