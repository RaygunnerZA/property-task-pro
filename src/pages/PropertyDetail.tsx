import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProperty } from "@/hooks/property/useProperty";
import { useTasks } from "@/hooks/use-tasks";
import { useAssets } from "@/hooks/use-assets";
import { AssetCard } from "@/components/assets/AssetCard";
import { CreateAssetDialog } from "@/components/assets/CreateAssetDialog";
import { MapPin, Plus, Trash2, Archive, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProperties } from "@/hooks/useProperties";
import { useSpaces } from "@/hooks/useSpaces";
import { propertiesService } from "@/services/properties/properties";
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
import { NeomorphicButton } from "@/components/design-system/NeomorphicButton";

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { property, loading: propertyLoading } = useProperty(id);
  const { tasks, loading: tasksLoading } = useTasks();
  const { assets, loading: assetsLoading, refresh: refreshAssets } = useAssets();
  const { properties, refresh: refreshProperties } = useProperties();
  const { spaces } = useSpaces(id);
  const [showCreateAsset, setShowCreateAsset] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  // Filter tasks by property_id
  const propertyTasks = useMemo(() => {
    if (!id) return [];
    return tasks.filter((task) => task.property_id === id);
  }, [tasks, id]);

  // Filter assets by property_id
  const propertyAssets = useMemo(() => {
    if (!id) return [];
    return assets.filter((asset) => asset.property_id === id);
  }, [assets, id]);

  // Count open tasks (status is 'open' or 'in_progress')
  const openTasksCount = useMemo(() => {
    return propertyTasks.filter(
      (task) => task.status === "open" || task.status === "in_progress"
    ).length;
  }, [propertyTasks]);

  // Create property and space maps for asset display
  const propertyMap = useMemo(() => {
    return new Map(properties.map((p) => [p.id, p.nickname || p.address]));
  }, [properties]);

  const spaceMap = useMemo(() => {
    return new Map(spaces.map((s) => [s.id, s.name]));
  }, [spaces]);

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
        refreshProperties();
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
      title={displayName}
      subtitle={property.address}
      backTo="/properties"
      icon={<Building2 className="h-6 w-6" />}
      action={
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowArchiveDialog(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Archive className="h-4 w-4 mr-2" />
            Archive
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      }
      maxWidth="xl"
      headerClassName={property.thumbnail_url ? "relative" : ""}
    >
      {/* Image Header */}
      {property.thumbnail_url && (
        <div className="w-full h-64 bg-muted overflow-hidden -mx-4 -mt-6 mb-6">
          <img
            src={property.thumbnail_url}
            alt={displayName}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Tabs */}
      <div>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="p-6">
                <div className="text-sm text-muted-foreground mb-1">
                  Open Tasks
                </div>
                <div className="text-3xl font-bold text-foreground">
                  {openTasksCount}
                </div>
              </Card>
              <Card className="p-6">
                <div className="text-sm text-muted-foreground mb-1">
                  Assets
                </div>
                <div className="text-3xl font-bold text-foreground">
                  {propertyAssets.length}
                </div>
              </Card>
              <Card className="p-6">
                <div className="text-sm text-muted-foreground mb-1">
                  Spaces
                </div>
                <div className="text-3xl font-bold text-foreground">
                  {spaces.length}
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="mt-6">
            {tasksLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading tasks...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Filter TaskList to show only property tasks */}
                {propertyTasks.length === 0 ? (
                  <Card className="p-8 text-center">
                    <h3 className="font-semibold text-lg mb-2">No tasks</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      This property doesn't have any tasks yet.
                    </p>
                    <Button
                      onClick={() => navigate(`/add-task?propertyId=${id}`)}
                    >
                      Add Task
                    </Button>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {propertyTasks
                      .filter(
                        (task) =>
                          task.status === "open" || task.status === "in_progress"
                      )
                      .map((task) => {
                        const propertyData = properties.find(
                          (p) => p.id === task.property_id
                        );
                        return (
                          <div
                            key={task.id}
                            className="p-4 bg-card rounded-lg shadow-e1 border border-border cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => navigate(`/task/${task.id}`)}
                          >
                            <div className="font-semibold text-foreground mb-1">
                              {task.title || "Untitled Task"}
                            </div>
                            {task.description && (
                              <div className="text-sm text-muted-foreground line-clamp-2">
                                {task.description}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {task.status}
                              </Badge>
                              {task.priority && (
                                <Badge variant="outline" className="text-xs">
                                  {task.priority}
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    {propertyTasks.filter((task) => task.status === "completed")
                      .length > 0 && (
                      <div className="mt-6">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                          Completed ({propertyTasks.filter((task) => task.status === "completed").length})
                        </h3>
                        <div className="space-y-3">
                          {propertyTasks
                            .filter((task) => task.status === "completed")
                            .map((task) => {
                              return (
                                <div
                                  key={task.id}
                                  className="p-4 bg-card rounded-lg shadow-e1 border border-border cursor-pointer hover:shadow-md transition-shadow opacity-60"
                                  onClick={() => navigate(`/task/${task.id}`)}
                                >
                                  <div className="font-semibold text-foreground mb-1">
                                    {task.title || "Untitled Task"}
                                  </div>
                                  {task.description && (
                                    <div className="text-sm text-muted-foreground line-clamp-2">
                                      {task.description}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Assets Tab */}
          <TabsContent value="assets" className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Assets</h3>
              <Button
                size="sm"
                onClick={() => setShowCreateAsset(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Asset
              </Button>
            </div>
            {assetsLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading assets...</p>
              </div>
            ) : propertyAssets.length === 0 ? (
              <Card className="p-8 text-center">
                <h3 className="font-semibold text-lg mb-2">No assets</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  This property doesn't have any assets yet.
                </p>
                <Button onClick={() => setShowCreateAsset(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Asset
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {propertyAssets.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    propertyName={propertyMap.get(asset.property_id)}
                    spaceName={
                      asset.space_id ? spaceMap.get(asset.space_id) : undefined
                    }
                    onClick={() => {
                      // Navigate to asset detail when implemented
                      // navigate(`/assets/${asset.id}`);
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Compliance Tab */}
          <TabsContent value="compliance" className="mt-6">
            <Card className="p-8 text-center">
              <h3 className="font-semibold text-lg mb-2">Compliance</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Compliance information will be displayed here.
              </p>
              <Button
                onClick={() => navigate(`/properties/${id}/compliance`)}
              >
                View Compliance
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <CreateAssetDialog
        open={showCreateAsset}
        onOpenChange={setShowCreateAsset}
        propertyId={id || ""}
        onAssetCreated={refreshAssets}
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

