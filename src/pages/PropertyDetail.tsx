import { useState, useMemo, useRef, useEffect, Suspense, lazy } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProperty } from "@/hooks/property/useProperty";
import { usePropertyPhotos } from "@/hooks/property/usePropertyPhotos";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useComplianceQuery } from "@/hooks/useComplianceQuery";
import { useQueryClient } from "@tanstack/react-query";
import { useSpaces } from "@/hooks/useSpaces";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useFileUpload } from "@/hooks/useFileUpload";
import { propertiesService } from "@/services/properties/properties";
import { TaskList } from "@/components/tasks/TaskList";
import { AssetList } from "@/components/assets/AssetList";
import { ComplianceList } from "@/components/compliance/ComplianceList";
import { CreateAssetDialog } from "@/components/assets/CreateAssetDialog";
import { MapPin, Plus, Trash2, Archive, Building2, Edit, MoreVertical, CheckSquare, Package, FolderOpen, ArrowRight, Check, X, Upload, ChevronLeft, ChevronRight } from "lucide-react";
// Lazy load PropertyImageDialog to isolate any import errors
const PropertyImageDialog = lazy(() => import("@/components/property/PropertyImageDialog").then(module => ({ default: module.PropertyImageDialog })));
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StandardPageWithBack } from "@/components/design-system/StandardPageWithBack";
import { LoadingState } from "@/components/design-system/LoadingState";
import { EmptyState } from "@/components/design-system/EmptyState";
import PropertyPhotoGallery from "@/components/property/media/PropertyPhotoGallery";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { property, loading: propertyLoading, refresh: refreshProperty } = useProperty(id);
  const { photos } = usePropertyPhotos(id || "");
  const { data: tasksData = [], isLoading: tasksLoading } = useTasksQuery(id);
  const { data: assetsData = [], isLoading: assetsLoading } = useAssetsQuery(id);
  const queryClient = useQueryClient();
  const { spaces } = useSpaces(id);
  const { orgId } = useActiveOrg();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Use file upload hook with automatic thumbnail generation
  const { uploadFile, isUploading: isUploadingImage } = useFileUpload({
    bucket: "property-images",
    generateThumbnail: true,
    recordId: id,
    table: "properties",
    onSuccess: async (url, thumbnailUrl) => {
      // Create version record with audit logging
      if (id) {
        try {
          await supabase.rpc("replace_property_image", {
            p_property_id: id,
            p_new_storage_path: url,
            p_new_thumbnail_path: thumbnailUrl || url,
            p_annotation_summary: null,
          });
        } catch (error) {
          console.error("Error creating image version record:", error);
          // Don't fail the upload if versioning fails
        }
      }

      // Refresh property data to show updated thumbnail
      await refreshProperty();
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    },
    onError: (error) => {
      console.error("Image upload error:", error);
      alert(`Failed to upload image: ${error.message}`);
    },
  });
  
  // Parse tasks from view (handles JSON arrays for spaces/themes/teams)
  const tasks = useMemo(() => {
    return tasksData.map((task: any) => ({
      ...task,
      spaces: typeof task.spaces === 'string' ? JSON.parse(task.spaces) : (task.spaces || []),
      themes: typeof task.themes === 'string' ? JSON.parse(task.themes) : (task.themes || []),
      teams: typeof task.teams === 'string' ? JSON.parse(task.teams) : (task.teams || []),
      assigned_user_id: task.assignee_user_id,
    }));
  }, [tasksData]);
  
  const assets = assetsData;
  const [showCreateAsset, setShowCreateAsset] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [isEditingOwner, setIsEditingOwner] = useState(false);
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedAddress, setEditedAddress] = useState("");
  const [editedOwnerName, setEditedOwnerName] = useState("");
  const [editedOwnerEmail, setEditedOwnerEmail] = useState("");
  const [editedContactName, setEditedContactName] = useState("");
  const [editedContactEmail, setEditedContactEmail] = useState("");
  const [editedContactPhone, setEditedContactPhone] = useState("");
  const [activeTab, setActiveTab] = useState("tasks");
  const thumbnailScrollRef = useRef<HTMLDivElement>(null);
  const [showImageDialog, setShowImageDialog] = useState(false);

  // Tasks are already filtered by property_id from the query
  const propertyTasks = tasks;

  // Assets are already filtered by property_id from the query
  const propertyAssets = assets;

  // Get property from properties_view to access aggregated counts
  const { data: properties = [] } = usePropertiesQuery();
  const propertyView = useMemo(() => {
    return properties.find((p: any) => p.id === id);
  }, [properties, id]);

  // Use counts from properties_view if available, otherwise calculate
  const openTasksCount = useMemo(() => {
    return propertyView?.open_tasks_count ?? propertyTasks.filter(
      (task) => task.status === "open" || task.status === "in_progress"
    ).length;
  }, [propertyView, propertyTasks]);
  const assetsCount = propertyView?.assets_count ?? propertyAssets.length;
  const spacesCount = propertyView?.spaces_count ?? spaces.length;

  // Initialize edited values when property loads
  useMemo(() => {
    if (property) {
      setEditedName(property.nickname || "");
      setEditedAddress(property.address || "");
      setEditedOwnerName((property as any).owner_name || "");
      setEditedOwnerEmail((property as any).owner_email || "");
      setEditedContactName((property as any).contact_name || "");
      setEditedContactEmail((property as any).contact_email || "");
      setEditedContactPhone((property as any).contact_phone || "");
    }
  }, [property]);

  // Handle save name
  const handleSaveName = async () => {
    if (!id || !property) return;
    try {
      const { error } = await supabase
        .from("properties")
        .update({ nickname: editedName || null })
        .eq("id", id);
      
      if (error) throw error;
      setIsEditingName(false);
      refreshProperty();
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    } catch (error) {
      console.error("Error updating property name:", error);
      alert("Failed to update property name");
      setEditedName(property.nickname || "");
    }
  };

  // Handle save address
  const handleSaveAddress = async () => {
    if (!id || !property) return;
    try {
      const { error } = await supabase
        .from("properties")
        .update({ address: editedAddress })
        .eq("id", id);
      
      if (error) throw error;
      setIsEditingAddress(false);
      refreshProperty();
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    } catch (error) {
      console.error("Error updating address:", error);
      alert("Failed to update address");
      setEditedAddress(property.address || "");
    }
  };

  // Handle save owner
  const handleSaveOwner = async () => {
    if (!id || !property) return;
    try {
      const { error } = await supabase
        .from("properties")
        .update({ 
          owner_name: editedOwnerName || null,
          owner_email: editedOwnerEmail || null,
        })
        .eq("id", id);
      
      if (error) throw error;
      setIsEditingOwner(false);
      refreshProperty();
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    } catch (error) {
      console.error("Error updating owner:", error);
      alert("Failed to update owner details");
      setEditedOwnerName((property as any).owner_name || "");
      setEditedOwnerEmail((property as any).owner_email || "");
    }
  };

  // Handle save contact
  const handleSaveContact = async () => {
    if (!id || !property) return;
    try {
      const { error } = await supabase
        .from("properties")
        .update({ 
          contact_name: editedContactName || null,
          contact_email: editedContactEmail || null,
          contact_phone: editedContactPhone || null,
        })
        .eq("id", id);
      
      if (error) throw error;
      setIsEditingContact(false);
      refreshProperty();
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    } catch (error) {
      console.error("Error updating contact:", error);
      alert("Failed to update contact details");
      setEditedContactName((property as any).contact_name || "");
      setEditedContactEmail((property as any).contact_email || "");
      setEditedContactPhone((property as any).contact_phone || "");
    }
  };

  // Handle image upload using useFileUpload hook (with automatic thumbnail generation)
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id || !orgId) return;

    // Generate file path
    const fileExt = file.name.split(".").pop();
    const fileName = `${orgId}/${id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    // Upload file with automatic thumbnail generation
    // Version record will be created in the onSuccess callback
    await uploadFile(file, fileName);
    
    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (propertyLoading) {
    return (
      <StandardPageWithBack
        title="Property Details"
        backTo="/properties"
        icon={<Building2 className="h-6 w-6" />}
        maxWidth="full"
      >
        <LoadingState message="Loading property..." />
      </StandardPageWithBack>
    );
  }

  if (!property) {
    return (
      <StandardPageWithBack
        title="Property Details"
        backTo="/properties"
        icon={<Building2 className="h-6 w-6" />}
        maxWidth="full"
      >
        <EmptyState
          icon={Building2}
          title="Property not found"
          description="The property you're looking for doesn't exist or you don't have access to it."
          action={{
            label: "Go to Properties",
            onClick: () => navigate("/properties")
          }}
        />
      </StandardPageWithBack>
    );
  }

  const displayName = property.nickname || property.address;
  const primaryImage = property.thumbnail_url;

  const handleDelete = async () => {
    if (!id) return;
    setIsDeleting(true);
    try {
      const result = await propertiesService.deleteProperty(id);
      if (result.success) {
        navigate("/properties");
      } else {
        console.error("Failed to delete property:", result.error);
        alert("Failed to delete property. Please try again.");
      }
    } catch (error) {
      console.error("Error deleting property:", error);
      alert("Failed to delete property. Please try again.");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleArchive = async () => {
    if (!id) return;
    setIsArchiving(true);
    try {
      const result = await propertiesService.archiveProperty(id);
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["properties"] });
        navigate("/properties");
      } else {
        console.error("Failed to archive property:", result.error);
        alert("Failed to archive property. Please try again.");
      }
    } catch (error) {
      console.error("Error archiving property:", error);
      alert("Failed to archive property. Please try again.");
    } finally {
      setIsArchiving(false);
      setShowArchiveDialog(false);
    }
  };

  return (
    <StandardPageWithBack
      title=""
      backTo="/properties"
      icon={<Building2 className="h-6 w-6" />}
      maxWidth="full"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* Left Column: Profile Image + Media Gallery */}
        <div className="space-y-4">
          {/* Square Profile Image */}
          <div className="aspect-square w-full bg-muted rounded-lg overflow-hidden shadow-e1 relative group">
            {primaryImage ? (
              <>
                <img
                  src={primaryImage}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    className="p-1.5 bg-black/50 rounded-[5px] hover:bg-black/70 text-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowImageDialog(true);
                    }}
                  >
                    <Edit className="h-3 w-3" />
                  </button>
                </div>
                <div 
                  className="absolute inset-0 cursor-pointer"
                  onClick={() => setShowImageDialog(true)}
                  title="Click to edit image"
                />
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                <Building2 className="h-16 w-16 mb-2" />
                <span className="text-sm">No image</span>
              </div>
            )}
          </div>

          {/* Media Gallery Thumbnails - Only show when 2+ images exist (hide when only one primary image) */}
          {photos.length > 1 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Media Gallery
              </h3>
              <div className="relative">
                {/* Container with overflow hidden to show only 3 thumbnails */}
                <div className="overflow-hidden" style={{ width: 'calc(3 * 6rem + 2 * 0.5rem)' }}>
                  {/* Scrollable thumbnail container */}
                  <div
                    ref={thumbnailScrollRef}
                    className="flex gap-2 overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                  >
                    {photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="aspect-square w-24 h-24 flex-shrink-0 bg-muted rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity relative group"
                        onClick={() => {
                          // TODO: Open photo viewer
                        }}
                      >
                        <img
                          src={photo.url}
                          alt={photo.caption || "Property photo"}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="p-1 bg-black/50 rounded-[5px] hover:bg-black/70 text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              // TODO: Archive/delete image
                            }}
                          >
                            <Edit className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Navigation arrows - only show if more than 3 photos */}
                {photos.length > 3 && (
                  <>
                    <button
                      onClick={() => {
                        if (thumbnailScrollRef.current) {
                          const scrollAmount = 104; // 96px (w-24) + 8px (gap-2)
                          thumbnailScrollRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
                        }
                      }}
                      className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 p-1.5 bg-background/90 backdrop-blur-sm rounded-full shadow-md hover:bg-background border border-border transition-colors z-10"
                      aria-label="Scroll left"
                    >
                      <ChevronLeft className="h-4 w-4 text-foreground" />
                    </button>
                    <button
                      onClick={() => {
                        if (thumbnailScrollRef.current) {
                          const scrollAmount = 104; // 96px (w-24) + 8px (gap-2)
                          thumbnailScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
                        }
                      }}
                      className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1 p-1.5 bg-background/90 backdrop-blur-sm rounded-full shadow-md hover:bg-background border border-border transition-colors z-10"
                      aria-label="Scroll right"
                    >
                      <ChevronRight className="h-4 w-4 text-foreground" />
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Add Image Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingImage}
          >
            {isUploadingImage ? (
              <>
                <Upload className="h-4 w-4 mr-2 animate-pulse" />
                Uploading...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add Image
              </>
            )}
          </Button>
        </div>

        {/* Middle Column: Property Info + Dashboard + Tabs */}
        <div className="space-y-6">
          {/* Property ID Card */}
          <Card className="p-6 shadow-e1">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Property Name Column (First Column) */}
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                  Property Name
                </div>
                {isEditingName ? (
                  <div className="space-y-2">
                    <Input
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleSaveName();
                        }
                        if (e.key === "Escape") {
                          setIsEditingName(false);
                          setEditedName(property.nickname || "");
                        }
                      }}
                      className="text-xl font-semibold"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleSaveName}
                        className="h-8 px-3"
                      >
                        <Check className="h-4 w-4 text-primary mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsEditingName(false);
                          setEditedName(property.nickname || "");
                        }}
                        className="h-8 px-3"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <h1
                      className="text-xl font-semibold cursor-pointer hover:text-primary transition-colors"
                      onClick={() => setIsEditingName(true)}
                    >
                      {displayName}
                    </h1>
                    {/* Options Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="p-1.5 rounded-[5px] hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Property options"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          // TODO: Open edit dialog
                        }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Property
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setShowArchiveDialog(true)}>
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setShowDeleteDialog(true)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>

              {/* Owner Column (Second Column) */}
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                  Owner
                </div>
                {isEditingOwner ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Owner name"
                      value={editedOwnerName}
                      onChange={(e) => setEditedOwnerName(e.target.value)}
                      className="text-sm"
                      autoFocus
                    />
                    <Input
                      placeholder="Owner email"
                      type="email"
                      value={editedOwnerEmail}
                      onChange={(e) => setEditedOwnerEmail(e.target.value)}
                      className="text-sm"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleSaveOwner}
                        className="h-8 px-3"
                      >
                        <Check className="h-4 w-4 text-primary mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsEditingOwner(false);
                          setEditedOwnerName((property as any).owner_name || "");
                          setEditedOwnerEmail((property as any).owner_email || "");
                        }}
                        className="h-8 px-3"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="text-sm cursor-pointer hover:text-primary transition-colors flex items-center justify-between group"
                    onClick={() => setIsEditingOwner(true)}
                  >
                    {(property as any).owner_name || (property as any).owner_email ? (
                      <div>
                        {(property as any).owner_name && (
                          <div className="font-medium">{(property as any).owner_name}</div>
                        )}
                        {(property as any).owner_email && (
                          <div className="text-muted-foreground text-xs">{(property as any).owner_email}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">Add Owner</span>
                    )}
                    <Edit className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
              </div>

              {/* Contact Column (Third Column) */}
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                  Contact
                </div>
                {isEditingContact ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Contact name"
                      value={editedContactName}
                      onChange={(e) => setEditedContactName(e.target.value)}
                      className="text-sm"
                      autoFocus
                    />
                    <Input
                      placeholder="Contact email"
                      type="email"
                      value={editedContactEmail}
                      onChange={(e) => setEditedContactEmail(e.target.value)}
                      className="text-sm"
                    />
                    <Input
                      placeholder="Contact phone"
                      type="tel"
                      value={editedContactPhone}
                      onChange={(e) => setEditedContactPhone(e.target.value)}
                      className="text-sm"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleSaveContact}
                        className="h-8 px-3"
                      >
                        <Check className="h-4 w-4 text-primary mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setIsEditingContact(false);
                          setEditedContactName((property as any).contact_name || "");
                          setEditedContactEmail((property as any).contact_email || "");
                          setEditedContactPhone((property as any).contact_phone || "");
                        }}
                        className="h-8 px-3"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="text-sm cursor-pointer hover:text-primary transition-colors flex items-center justify-between group"
                    onClick={() => setIsEditingContact(true)}
                  >
                    {(property as any).contact_name || (property as any).contact_email || (property as any).contact_phone ? (
                      <div>
                        {(property as any).contact_name && (
                          <div className="font-medium">{(property as any).contact_name}</div>
                        )}
                        {(property as any).contact_email && (
                          <div className="text-muted-foreground text-xs">{(property as any).contact_email}</div>
                        )}
                        {(property as any).contact_phone && (
                          <div className="text-muted-foreground text-xs">{(property as any).contact_phone}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">Add Contact</span>
                    )}
                    <Edit className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
              </div>

              {/* Address (Editable) - Below 2nd and 3rd columns */}
              <div className="md:col-start-2 md:col-span-2">
                {isEditingAddress ? (
                  <Input
                    value={editedAddress}
                    onChange={(e) => setEditedAddress(e.target.value)}
                    onBlur={handleSaveAddress}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSaveAddress();
                      }
                      if (e.key === "Escape") {
                        setIsEditingAddress(false);
                        setEditedAddress(property.address || "");
                      }
                    }}
                    className="text-sm"
                    autoFocus
                  />
                ) : (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span
                      className="text-sm cursor-pointer hover:text-primary transition-colors flex-1"
                      onClick={() => setIsEditingAddress(true)}
                    >
                      {property.address}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Dashboard Panel: 3 Cards */}
          <div className="flex justify-center items-center gap-4">
            {/* Open Tasks Card */}
            <Card 
              className="p-6 shadow-e1 bg-gradient-to-br from-[#8EC9CE]/20 to-[#8EC9CE]/10 border border-[#8EC9CE]/30 w-[138px] h-[138px]"
              style={{ background: 'linear-gradient(135deg, rgba(142, 201, 206, 0.2) 0%, rgba(142, 201, 206, 0.1) 100%)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <CheckSquare className="h-5 w-5 text-[#8EC9CE]" />
              </div>
              <div className="text-sm text-muted-foreground mb-1">Open Tasks</div>
              <div className="text-3xl font-bold text-[#8EC9CE]">{openTasksCount}</div>
            </Card>

            {/* Assets Card */}
            <Card
              className="p-6 shadow-e1 bg-gradient-to-br from-[#6B9BD1]/20 to-[#6B9BD1]/10 border border-[#6B9BD1]/30 cursor-pointer hover:shadow-md transition-shadow relative group w-[138px] h-[138px]"
              onClick={() => navigate(`/properties/${id}?tab=assets`)}
            >
              <div className="flex items-center justify-between mb-2">
                <Package className="h-5 w-5 text-[#6B9BD1]" />
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-[#6B9BD1] transition-colors" />
              </div>
              <div className="text-sm text-muted-foreground mb-1">Assets</div>
              <div className="text-3xl font-bold text-[#6B9BD1]">{assetsCount}</div>
            </Card>

            {/* Spaces Card */}
            <Card
              className="p-6 shadow-e1 bg-gradient-to-br from-[#A8D5BA]/20 to-[#A8D5BA]/10 border border-[#A8D5BA]/30 cursor-pointer hover:shadow-md transition-shadow relative group w-[138px] h-[138px]"
              onClick={() => navigate(`/properties/${id}?tab=spaces`)}
            >
              <div className="flex items-center justify-between mb-2">
                <FolderOpen className="h-5 w-5 text-[#A8D5BA]" />
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-[#A8D5BA] transition-colors" />
              </div>
              <div className="text-sm text-muted-foreground mb-1">Spaces</div>
              <div className="text-3xl font-bold text-[#A8D5BA]">{spaces.length}</div>
            </Card>
          </div>

          {/* Tabs Section */}
          <div className="w-full">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {/* Sticky Tab Bar */}
              <div className="sticky top-0 z-10 bg-background border-b border-border/50">
                <TabsList
                  className={cn(
                    "w-full grid grid-cols-4 h-12 py-1 px-2 rounded-[15px] bg-transparent",
                    "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.08),inset_-2px_-2px_4px_rgba(255,255,255,0.7)]"
                  )}
                >
                  <TabsTrigger
                    value="tasks"
                    className={cn(
                      "rounded-lg transition-all",
                      "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]",
                      "data-[state=active]:bg-card",
                      "data-[state=inactive]:bg-transparent",
                      "text-sm font-medium"
                    )}
                  >
                    Tasks
                  </TabsTrigger>
                  <TabsTrigger
                    value="assets"
                    className={cn(
                      "rounded-lg transition-all",
                      "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]",
                      "data-[state=active]:bg-card",
                      "data-[state=inactive]:bg-transparent",
                      "text-sm font-medium"
                    )}
                  >
                    Assets
                  </TabsTrigger>
                  <TabsTrigger
                    value="documents"
                    className={cn(
                      "rounded-lg transition-all",
                      "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]",
                      "data-[state=active]:bg-card",
                      "data-[state=inactive]:bg-transparent",
                      "text-sm font-medium"
                    )}
                  >
                    <span className="hidden md:inline">Documents</span>
                    <span className="md:hidden">Docs</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="compliance"
                    className={cn(
                      "rounded-lg transition-all",
                      "data-[state=active]:shadow-[3px_3px_8px_rgba(0,0,0,0.12),-2px_-2px_6px_rgba(255,255,255,0.8)]",
                      "data-[state=active]:bg-card",
                      "data-[state=inactive]:bg-transparent",
                      "text-sm font-medium"
                    )}
                  >
                    Compliance
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Scrollable Content Area */}
              <div className="bg-background">
                {/* Tasks Tab */}
                <TabsContent value="tasks" className="mt-0 py-4 px-[3px]">
                  <TaskList
                    onTaskClick={(taskId) => navigate(`/task/${taskId}`)}
                  />
                </TabsContent>

                {/* Assets Tab */}
                <TabsContent value="assets" className="mt-0 p-4">
                  <AssetList propertyId={id} />
                </TabsContent>

                {/* Documents Tab */}
                <TabsContent value="documents" className="mt-0 p-4">
                  <EmptyState
                    title="No documents"
                    subtitle="Documents will appear here"
                  />
          </TabsContent>

          {/* Compliance Tab */}
                <TabsContent value="compliance" className="mt-0 p-4">
                  <ComplianceList propertyId={id} />
          </TabsContent>
              </div>
        </Tabs>
          </div>
        </div>
      </div>

      <CreateAssetDialog
        open={showCreateAsset}
        onOpenChange={setShowCreateAsset}
        propertyId={id || ""}
        onAssetCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["assets", undefined, id] });
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Property</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{displayName}"? This action cannot be undone and will permanently remove the property and all associated data from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Property Image Dialog */}
      {primaryImage && (
        <Suspense fallback={<div className="p-4 text-muted-foreground">Loading...</div>}>
          <PropertyImageDialog
            open={showImageDialog}
            onOpenChange={setShowImageDialog}
            propertyId={id || ""}
            imageUrl={primaryImage}
            onImageUpdated={async () => {
              await refreshProperty();
              queryClient.invalidateQueries({ queryKey: ["properties"] });
            }}
          />
        </Suspense>
      )}

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Property</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive "{displayName}"? The property will be hidden from the properties list but will remain in the database. You can restore it later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={isArchiving}
            >
              {isArchiving ? "Archiving..." : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </StandardPageWithBack>
  );
}
