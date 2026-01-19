import { useState, useMemo, useRef, useEffect, Suspense, lazy } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
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
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { CreateTaskModal } from "@/components/tasks/CreateTaskModal";
import { CreateAssetDialog } from "@/components/assets/CreateAssetDialog";
import { DualPaneLayout } from "@/components/layout/DualPaneLayout";
import { PropertyIdentityCard } from "@/components/properties/PropertyIdentityCard";
import { PropertySpacesList } from "@/components/properties/PropertySpacesList";
import { PropertyRelatedEntities } from "@/components/properties/PropertyRelatedEntities";
import { PropertyTasksSection } from "@/components/properties/PropertyTasksSection";
import { PropertySpacesSection } from "@/components/properties/PropertySpacesSection";
import { ComplianceOverviewSection } from "@/components/properties/ComplianceOverviewSection";
import { DocumentsSection } from "@/components/properties/DocumentsSection";
import { MediaGallerySection } from "@/components/properties/MediaGallerySection";
import { QuickActionsSection } from "@/components/properties/QuickActionsSection";
import { usePropertyDocuments } from "@/hooks/property/usePropertyDocuments";
import { DashboardCalendar } from "@/components/dashboard/DashboardCalendar";
import { DailyBriefingCard } from "@/components/dashboard/DailyBriefingCard";
import { Plus, Trash2, Archive, Building2, Edit, Check, X, Upload, Home, Hotel, Warehouse, Store, Castle } from "lucide-react";
// Lazy load PropertyImageDialog to isolate any import errors
const PropertyImageDialog = lazy(() => import("@/components/property/PropertyImageDialog").then(module => ({ default: module.PropertyImageDialog })));
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/design-system/LoadingState";
import { EmptyState } from "@/components/design-system/EmptyState";
import { StandardPageWithBack } from "@/components/design-system/StandardPageWithBack";
import { PageHeader } from "@/components/design-system/PageHeader";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const PROPERTY_ICONS = {
  home: Home,
  building: Building2,
  hotel: Hotel,
  warehouse: Warehouse,
  store: Store,
  castle: Castle,
} as const;

const PROPERTY_COLORS = [
  "#FF6B6B", // Coral
  "#4ECDC4", // Teal
  "#45B7D1", // Sky Blue
  "#96CEB4", // Sage
  "#FFEAA7", // Yellow
  "#DDA0DD", // Plum
];

const LG_BREAKPOINT = 1024;

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
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  
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
  const thumbnailScrollRef = useRef<HTMLDivElement>(null);
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showIconEditDialog, setShowIconEditDialog] = useState(false);
  const [editedIconName, setEditedIconName] = useState("");
  const [editedIconColor, setEditedIconColor] = useState("");
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  useEffect(() => {
    const updateScreenSize = () => {
      setIsLargeScreen(window.innerWidth >= LG_BREAKPOINT);
    };
    updateScreenSize();
    window.addEventListener("resize", updateScreenSize);
    return () => window.removeEventListener("resize", updateScreenSize);
  }, []);
  
  // Additional data hooks
  const { data: compliance = [] } = useComplianceQuery(id);
  const { documents } = usePropertyDocuments(id || "");

  // Tasks are already filtered by property_id from the query
  const propertyTasks = tasks;

  const handleOpenCreateTask = () => {
    // Wide screen: opening create task should collapse any open task detail
    setSelectedTaskId(null);
    setShowCreateTask(true);
  };

  const handleTaskClick = (taskId: string) => {
    // Wide screen: selecting a task should auto-minimise the Create Task accordion
    if (isLargeScreen) {
      setShowCreateTask(false);
    }
    setSelectedTaskId(taskId);
  };

  // Calculate tasksByDate for calendar (only property tasks)
  const tasksByDate = useMemo(() => {
    const dateMap = new Map<string, {
      total: number;
      high: number;
      urgent: number;
      overdue: number;
    }>();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Normalize priority helper
    const normalizePriority = (priority: string | null | undefined): string => {
      if (!priority) return 'normal';
      const normalized = priority.toLowerCase();
      if (normalized === 'medium') return 'normal';
      return normalized;
    };
    
    propertyTasks.forEach((task) => {
      const dueDateValue = task.due_date || task.due_at;
      
      if (dueDateValue && task.status !== 'completed' && task.status !== 'archived') {
        try {
          const date = new Date(dueDateValue);
          const dateKey = format(date, "yyyy-MM-dd");
          const current = dateMap.get(dateKey) || { total: 0, high: 0, urgent: 0, overdue: 0 };
          
          current.total += 1;
          
          const priority = normalizePriority(task.priority);
          
          if (priority === 'high') {
            current.high += 1;
          } else if (priority === 'urgent') {
            current.urgent += 1;
          }
          
          // Check if overdue
          date.setHours(0, 0, 0, 0);
          if (date < today) {
            current.overdue += 1;
          }
          
          dateMap.set(dateKey, current);
        } catch {
          // Skip invalid dates
        }
      }
    });
    
    return dateMap;
  }, [propertyTasks]);

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
      setEditedIconName((property as any).icon_name || "home");
      setEditedIconColor((property as any).icon_color_hex || "#8EC9CE");
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

  // Handle save icon and color
  const handleSaveIcon = async () => {
    if (!id || !property) return;
    try {
      const { error } = await supabase
        .from("properties")
        .update({ 
          icon_name: editedIconName || null,
          icon_color_hex: editedIconColor || null,
        })
        .eq("id", id);
      
      if (error) throw error;
      setShowIconEditDialog(false);
      refreshProperty();
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    } catch (error) {
      console.error("Error updating icon:", error);
      alert("Failed to update icon and color");
      setEditedIconName((property as any).icon_name || "home");
      setEditedIconColor((property as any).icon_color_hex || "#8EC9CE");
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
        maxWidth="xl"
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
        maxWidth="xl"
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

  // Prepare property data for PropertyIdentityCard
  const propertyWithContacts = property ? {
    ...property,
    owner_name: (property as any).owner_name,
    owner_email: (property as any).owner_email,
    contact_name: (property as any).contact_name,
    contact_email: (property as any).contact_email,
    contact_phone: (property as any).contact_phone,
  } : null;

  // Get property icon and color for header
  const iconName = (property as any).icon_name || "home";
  const IconComponent = PROPERTY_ICONS[iconName as keyof typeof PROPERTY_ICONS] || Home;
  const iconColor = (property as any).icon_color_hex || "#8EC9CE";
  
  // Paper background color (from design system: hsl(40, 20%, 94%) = #F1EEE8)
  const paperBg = "#F1EEE8";
  
  // Paper texture pattern (from design system)
  const paperTexture = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise-filter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.522' numOctaves='1' stitchTiles='stitch'%3E%3C/feTurbulence%3E%3CfeColorMatrix type='saturate' values='0'%3E%3C/feColorMatrix%3E%3CfeComponentTransfer%3E%3CfeFuncR type='linear' slope='0.468'%3E%3C/feFuncR%3E%3CfeFuncG type='linear' slope='0.468'%3E%3C/feFuncG%3E%3CfeFuncB type='linear' slope='0.468'%3E%3C/feFuncB%3E%3CfeFuncA type='linear' slope='0.137'%3E%3C/feFuncA%3E%3C/feComponentTransfer%3E%3CfeComponentTransfer%3E%3CfeFuncR type='linear' slope='1.323' intercept='-0.207'/%3E%3CfeFuncG type='linear' slope='1.323' intercept='-0.207'/%3E%3CfeFuncB type='linear' slope='1.323' intercept='-0.207'/%3E%3C/feComponentTransfer%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise-filter)' opacity='0.8'%3E%3C/rect%3E%3C/svg%3E")`;
  
  // Create gradient: property color solid until 20%, then transition to paper bg by 70%
  // Paper bg with texture is set as base background, gradient overlays on top
  const gradientStyle = {
    backgroundColor: paperBg,
    backgroundImage: `${paperTexture}, linear-gradient(to right, ${iconColor} 0%, ${iconColor} 20%, ${iconColor} 20%, ${paperBg} 70%, ${paperBg} 100%)`,
    backgroundSize: '100%, 100%'
  };

  return (
    <div className="min-h-screen bg-background w-full max-w-full overflow-x-hidden">
      <PageHeader>
        <div 
          className="mx-auto px-4 pt-[63px] pb-4 h-[115px] flex items-center justify-between max-w-full"
          style={gradientStyle}
        >
          <div className="flex items-center gap-3">
            <span className="shrink-0">
              <IconComponent className="h-6 w-6 text-white" />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-white leading-tight">{displayName}</h1>
            </div>
          </div>
        </div>
      </PageHeader>
      <DualPaneLayout
        leftColumn={
          <div className="h-screen flex flex-col overflow-y-auto overflow-x-hidden w-full max-w-full">
            {/* Contact Card - Above calendar */}
            {propertyWithContacts && id && (
              <PropertyIdentityCard
                property={propertyWithContacts}
                onAddTask={() => {
                  handleOpenCreateTask();
                }}
                onAddPhoto={() => fileInputRef.current?.click()}
                onMessage={() => {
                  // TODO: Open message dialog
                }}
                onCall={() => {
                  const phone = (property as any).contact_phone;
                  if (phone) {
                    window.location.href = `tel:${phone}`;
                  }
                }}
              />
            )}

            {/* Calendar Section - Below contact card */}
            <div className="flex-shrink-0 border-b border-border w-full">
              <div className="px-4 pt-4 pb-4 w-full">
                {tasksLoading ? (
                  <div className="rounded-lg bg-card p-3 shadow-e1 w-full">
                    <div className="h-64 w-full bg-muted/50 rounded-lg animate-pulse" />
                  </div>
                ) : (
                  <div className="rounded-lg bg-card p-3 shadow-e1 w-full">
                    <DashboardCalendar
                      tasks={propertyTasks}
                      selectedDate={selectedDate}
                      onDateSelect={setSelectedDate}
                      tasksByDate={tasksByDate}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Property Info Sections - Below calendar */}
            {id && (
              <>
                <PropertySpacesList
                  propertyId={id}
                  tasks={propertyTasks}
                  onSpaceClick={setSelectedSpaceId}
                  selectedSpaceId={selectedSpaceId}
                />
                <div className="px-4 pb-4">
                  <QuickActionsSection propertyId={id} />
                </div>
                <PropertyRelatedEntities
                  propertyId={id}
                  tasks={propertyTasks}
                />
              </>
            )}
          </div>
        }
        rightColumn={
          <div className="min-h-screen bg-background overflow-y-auto">
            <div className="p-[15px] space-y-6">
              {/* Spaces Section */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Spaces</h2>
                {id && <PropertySpacesSection propertyId={id} />}
              </div>

              {/* Property Tasks Section */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Property Tasks</h2>
                <PropertyTasksSection
                  propertyId={id || ""}
                  tasks={propertyTasks}
                  properties={properties}
                  tasksLoading={tasksLoading}
                  selectedSpaceId={selectedSpaceId}
                  onTaskClick={handleTaskClick}
                  selectedTaskId={selectedTaskId || undefined}
                />
              </div>

              {/* Compliance Overview Section */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Compliance Overview</h2>
                {id && <ComplianceOverviewSection propertyId={id} />}
              </div>

              {/* Documents Section */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Documents</h2>
                <DocumentsSection documents={documents} />
              </div>

              {/* Media Gallery Section */}
              <div className="space-y-4">
                {id && (
                  <MediaGallerySection
                    propertyId={id}
                    onImageUpdated={() => {
                      refreshProperty();
                      queryClient.invalidateQueries({ queryKey: ["properties"] });
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        }
        thirdColumn={
          isLargeScreen
            ? (
              <div className="flex flex-col gap-4">
                <CreateTaskModal
                  open={showCreateTask}
                  onOpenChange={setShowCreateTask}
                  defaultPropertyId={id || ""}
                  onTaskCreated={() => {
                    queryClient.invalidateQueries({ queryKey: ["tasks", orgId, id] });
                  }}
                  variant="column"
                />
                {selectedTaskId ? (
                  <TaskDetailPanel
                    taskId={selectedTaskId}
                    onClose={() => setSelectedTaskId(null)}
                    variant="column"
                  />
                ) : null}
              </div>
            )
            : undefined
        }
      />

      {/* Dialogs */}
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

      {/* Icon Edit Dialog */}
      <Dialog open={showIconEditDialog} onOpenChange={setShowIconEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Property Icon</DialogTitle>
            <DialogDescription>
              Choose an icon and color for this property
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Icon Preview */}
            <div className="flex justify-center">
              {(() => {
                const SelectedIcon = PROPERTY_ICONS[editedIconName as keyof typeof PROPERTY_ICONS] || Home;
                return (
                  <div
                    className="p-4 rounded-2xl transition-all duration-300"
                    style={{
                      backgroundColor: editedIconColor,
                      boxShadow:
                        "3px 3px 8px rgba(0,0,0,0.1), -2px -2px 6px rgba(255,255,255,0.3)",
                    }}
                  >
                    <SelectedIcon className="w-10 h-10 text-white" />
                  </div>
                );
              })()}
            </div>

            {/* Icon Selection */}
            <div>
              <Label className="mb-2 block">Choose an icon</Label>
              <div className="flex justify-center gap-3 flex-wrap">
                {Object.entries(PROPERTY_ICONS).map(([name, Icon]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setEditedIconName(name)}
                    className={`p-3 rounded-xl transition-all duration-200 ${
                      editedIconName === name
                        ? "bg-white shadow-lg scale-110"
                        : "bg-muted hover:bg-white"
                    }`}
                    style={{
                      boxShadow:
                        editedIconName === name
                          ? "3px 3px 8px rgba(0,0,0,0.12), -2px -2px 6px rgba(255,255,255,0.8)"
                          : "inset 2px 2px 4px rgba(0,0,0,0.08), inset -2px -2px 4px rgba(255,255,255,0.7)",
                    }}
                  >
                    <Icon
                      className="w-6 h-6"
                      style={{
                        color: editedIconName === name ? editedIconColor : "#6D7480",
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Color Selection */}
            <div>
              <Label className="mb-2 block">Choose a color</Label>
              <div className="flex justify-center gap-3 flex-wrap">
                {PROPERTY_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setEditedIconColor(color)}
                    className={`w-10 h-10 rounded-full transition-all duration-200 ${
                      editedIconColor === color
                        ? "scale-125 ring-2 ring-offset-2 ring-gray-400"
                        : "hover:scale-110"
                    }`}
                    style={{
                      backgroundColor: color,
                      boxShadow:
                        editedIconColor === color
                          ? "3px 3px 8px rgba(0,0,0,0.12), -2px -2px 6px rgba(255,255,255,0.8)"
                          : "2px 2px 4px rgba(0,0,0,0.1), -1px -1px 2px rgba(255,255,255,0.3)",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowIconEditDialog(false);
                setEditedIconName((property as any).icon_name || "home");
                setEditedIconColor((property as any).icon_color_hex || "#8EC9CE");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveIcon}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!isLargeScreen && showCreateTask && (
        <CreateTaskModal
          open={showCreateTask}
          onOpenChange={setShowCreateTask}
          defaultPropertyId={id || ""}
          onTaskCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["tasks", orgId, id] });
          }}
          variant="modal"
        />
      )}

      {!isLargeScreen && selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          variant="modal"
        />
      )}
    </div>
  );
}
