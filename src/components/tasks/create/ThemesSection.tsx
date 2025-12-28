import { useState, useRef } from "react";
import { Tag, Plus, X, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { useThemes } from "@/hooks/useThemes";
import { supabase } from "@/integrations/supabase/client";
import { useDataContext } from "@/contexts/DataContext";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ThemesSectionProps {
  selectedThemeIds: string[];
  onThemesChange: (themeIds: string[]) => void;
  suggestedThemes?: Array<{ name: string; type?: 'category' | 'project' | 'tag' | 'group' }>;
}

export function ThemesSection({ selectedThemeIds, onThemesChange, suggestedThemes = [] }: ThemesSectionProps) {
  const { themes, refresh } = useThemes();
  const { orgId } = useDataContext();
  const { toast } = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newThemeName, setNewThemeName] = useState("");
  const [newThemeType, setNewThemeType] = useState<'category' | 'project' | 'tag' | 'group'>('category');
  const [creating, setCreating] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedIcon, setSelectedIcon] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [pendingGhostTheme, setPendingGhostTheme] = useState<{ name: string; type?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Identify ghost chips (suggested but not in DB)
  const existingThemeNames = themes.map(t => t.name.toLowerCase());
  const ghostThemes = suggestedThemes.filter(
    suggested => !existingThemeNames.includes(suggested.name.toLowerCase())
  );

  const handleGhostThemeClick = (themeName: string, themeType?: string) => {
    // Allow direct selection of ghost chips - store with ghost prefix and type
    // This enables "just-in-time" creation during task save
    const themeTypeValue = themeType || 'category';
    const ghostId = `ghost-theme-${themeName}-${themeTypeValue}`;
    if (selectedThemeIds.includes(ghostId)) {
      onThemesChange(selectedThemeIds.filter(id => id !== ghostId));
    } else {
      onThemesChange([...selectedThemeIds, ghostId]);
    }
    // Keep modal option for manual creation (optional)
    // setPendingGhostTheme({ name: themeName, type: themeType });
    // setNewThemeName(themeName);
    // setNewThemeType((themeType as any) || 'category');
    // setShowCreateModal(true);
  };

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

  const toggleTheme = (themeId: string) => {
    if (selectedThemeIds.includes(themeId)) {
      onThemesChange(selectedThemeIds.filter(id => id !== themeId));
    } else {
      onThemesChange([...selectedThemeIds, themeId]);
    }
  };

  const handleCreateTheme = async () => {
    if (!newThemeName.trim()) {
      toast({ 
        title: "Name required", 
        description: "Please enter a theme name.",
        variant: "destructive" 
      });
      return;
    }
    
    if (!orgId) {
      toast({ 
        title: "Organization not found", 
        description: "Your account is not linked to an organization. Please complete onboarding.",
        variant: "destructive" 
      });
      return;
    }
    
    setCreating(true);
    try {
      let imageUrl: string | null = null;

      // Upload image to task-images bucket under themes/ folder
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `themes/${orgId}/${crypto.randomUUID()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("task-images")
          .upload(fileName, imageFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("task-images")
          .getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }

      const { error } = await supabase
        .from("themes")
        .insert({
          org_id: orgId,
          name: newThemeName.trim(),
          type: newThemeType,
          color: selectedColor || undefined,
          icon: selectedIcon || undefined,
          metadata: imageUrl ? { image_url: imageUrl } : {},
        });

      if (error) throw error;

      toast({ title: "Theme created" });
      resetModal();
      setShowCreateModal(false);
      refresh();
    } catch (err: any) {
      console.error("Theme creation error:", err);
      toast({ 
        title: "Error creating theme", 
        description: err.message,
        variant: "destructive" 
      });
    } finally {
      setCreating(false);
    }
  };

  const resetModal = () => {
    setNewThemeName("");
    setNewThemeType('category');
    setSelectedIcon("");
    setSelectedColor("");
    clearImage();
    setPendingGhostTheme(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          Themes
        </Label>
        <button
          type="button"
          onClick={() => {
            resetModal();
            setShowCreateModal(true);
          }}
          className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3 w-3" />
          New
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {themes.map(theme => (
          <StandardChip
            key={theme.id}
            label={theme.name}
            selected={selectedThemeIds.includes(theme.id)}
            onSelect={() => toggleTheme(theme.id)}
            color={theme.color || (theme.type === 'project' ? '#FCD34D' : undefined)}
            icon={theme.icon ? <span>{theme.icon}</span> : <Tag className="h-3 w-3" />}
          />
        ))}
        
        {/* Ghost chips for AI suggestions */}
        {ghostThemes.map((ghost, idx) => {
          const themeTypeValue = ghost.type || 'category';
          const ghostId = `ghost-theme-${ghost.name}-${themeTypeValue}`;
          const isSelected = selectedThemeIds.includes(ghostId);
          return (
            <StandardChip
              key={`ghost-${idx}`}
              label={isSelected ? ghost.name : `+ ${ghost.name}`}
              ghost={!isSelected}
              selected={isSelected}
              onSelect={() => handleGhostThemeClick(ghost.name, ghost.type)}
              icon={<Tag className="h-3 w-3" />}
              color="#FCD34D"
            />
          );
        })}
        
        {themes.length === 0 && ghostThemes.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            No themes yet. Create one to organize tasks.
          </p>
        )}
      </div>

      {/* Create Theme Modal */}
      <Dialog open={showCreateModal} onOpenChange={(open) => {
        setShowCreateModal(open);
        if (!open) resetModal();
      }}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {pendingGhostTheme ? `Create "${pendingGhostTheme.name}"?` : "Create Theme"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              id="themeName"
              placeholder="Theme name"
              value={newThemeName}
              onChange={(e) => setNewThemeName(e.target.value)}
              className="shadow-engraved"
            />

            {/* Theme Type Selector */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Theme Type</Label>
              <Select value={newThemeType} onValueChange={(val) => setNewThemeType(val as any)}>
                <SelectTrigger className="shadow-engraved">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="category">Category</SelectItem>
                  <SelectItem value="project">Project</SelectItem>
                  <SelectItem value="tag">Tag</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Image row */}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
              
              {imagePreview ? (
                <div className="relative w-16 h-16 rounded-[5px] overflow-hidden border border-border">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
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
              <IconPicker value={selectedIcon} onChange={setSelectedIcon} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Choose Color</Label>
              <ColorPicker value={selectedColor} onChange={setSelectedColor} />
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
              onClick={handleCreateTheme}
              disabled={!newThemeName.trim() || creating}
            >
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

