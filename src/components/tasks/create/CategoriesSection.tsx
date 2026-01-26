import { useState, useRef } from "react";
import { Folder, Plus, X, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Chip } from "@/components/chips/Chip";
import { IconPicker } from "@/components/ui/IconPicker";
import { ColorPicker } from "@/components/ui/ColorPicker";
import { useCategories } from "@/hooks/useCategories";
import { supabase } from "@/integrations/supabase/client";
import { useDataContext } from "@/contexts/DataContext";
import { useToast } from "@/hooks/use-toast";

interface CategoriesSectionProps {
  selectedCategoryIds: string[];
  onCategoriesChange: (categoryIds: string[]) => void;
  suggestedCategories?: string[];
}

export function CategoriesSection({ selectedCategoryIds, onCategoriesChange, suggestedCategories = [] }: CategoriesSectionProps) {
  const { categories, refresh } = useCategories();
  const { orgId } = useDataContext();
  const { toast } = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creating, setCreating] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedIcon, setSelectedIcon] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [pendingGhostCategory, setPendingGhostCategory] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Identify ghost chips (suggested but not in DB)
  const existingCategoryNames = categories.map(c => c.name.toLowerCase());
  const ghostCategories = suggestedCategories.filter(
    suggested => !existingCategoryNames.includes(suggested.toLowerCase())
  );

  const handleGhostCategoryClick = (categoryName: string) => {
    setPendingGhostCategory(categoryName);
    setNewCategoryName(categoryName);
    setShowCreateModal(true);
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

  const toggleCategory = (categoryId: string) => {
    if (selectedCategoryIds.includes(categoryId)) {
      onCategoriesChange(selectedCategoryIds.filter(id => id !== categoryId));
    } else {
      onCategoriesChange([...selectedCategoryIds, categoryId]);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast({ 
        title: "Add a name", 
        description: "Enter a category name to continue.",
        variant: "destructive" 
      });
      return;
    }
    
    // Refresh session to ensure JWT has latest org_id claim
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError) {
      toast({ 
        title: "Sign in issue", 
        description: "Log out and back in to continue.",
        variant: "destructive" 
      });
      return;
    }

    // Get org_id from refreshed JWT claims
    const jwtOrgId = refreshData.session?.user?.app_metadata?.org_id;
    
    if (!jwtOrgId) {
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

      // Upload image to task-images bucket under categories/ folder
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `categories/${jwtOrgId}/${crypto.randomUUID()}.${fileExt}`;
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
          org_id: jwtOrgId,
          name: newCategoryName.trim(),
          type: "category",
          ...(imageUrl && { metadata: { image_url: imageUrl } }),
        });

      if (error) throw error;

      toast({ title: "Category created" });
      resetModal();
      setShowCreateModal(false);
      refresh();
    } catch (err: any) {
      console.error("Category creation error:", err);
      toast({ 
        title: "Couldn't create category", 
        description: err.message,
        variant: "destructive" 
      });
    } finally {
      setCreating(false);
    }
  };

  const resetModal = () => {
    setNewCategoryName("");
    setSelectedIcon("");
    setSelectedColor("");
    clearImage();
    setPendingGhostCategory(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Folder className="h-4 w-4 text-muted-foreground" />
          Categories
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

      <div className="space-y-2">
        {/* Row 1: AI Suggestions (if any) */}
        {ghostCategories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {ghostCategories.map((ghostName, idx) => (
              <Chip
                key={`ghost-${idx}`}
                role="suggestion"
                label={`+ ${ghostName.toUpperCase()}`}
                onSelect={() => handleGhostCategoryClick(ghostName)}
                animate={true}
              />
            ))}
          </div>
        )}

        {/* Row 2: Fact Chips (committed categories) */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <Chip
                key={category.id}
                role="fact"
                label={category.name.toUpperCase()}
                onRemove={() => toggleCategory(category.id)}
                icon={category.icon ? <span>{category.icon}</span> : undefined}
              />
            ))}
          </div>
        )}

        {categories.length === 0 && ghostCategories.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            No categories yet. Create one to organize tasks.
          </p>
        )}
      </div>

      {/* Create Category Modal */}
      <Dialog open={showCreateModal} onOpenChange={(open) => {
        setShowCreateModal(open);
        if (!open) resetModal();
      }}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {pendingGhostCategory ? `Create "${pendingGhostCategory}"?` : "Create Category"}
            </DialogTitle>
            <DialogDescription>
              {pendingGhostCategory
                ? `Create a new category called "${pendingGhostCategory}" to organize this task.`
                : "Create a new category to organize and group your tasks."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              id="categoryName"
              placeholder="Category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="shadow-engraved"
            />

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
                <div className="relative w-16 h-16 rounded-[8px] overflow-hidden shadow-e1">
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
                  className="w-16 h-16 rounded-[8px] border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:border-primary/50 transition-colors"
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
              onClick={handleCreateCategory}
              disabled={!newCategoryName.trim() || creating}
            >
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

