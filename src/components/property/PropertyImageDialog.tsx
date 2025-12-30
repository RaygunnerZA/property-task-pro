import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/filla/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { Archive, Replace, X, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface PropertyImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  imageUrl: string;
  onImageUpdated?: () => void;
}

export function PropertyImageDialog({
  open,
  onOpenChange,
  propertyId,
  imageUrl,
  onImageUpdated,
}: PropertyImageDialogProps) {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();
  const [isArchiving, setIsArchiving] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleArchive = async () => {
    if (!propertyId) return;

    setIsArchiving(true);
    try {
      // Get current active version
      const { data: currentVersion, error: versionError } = await supabase
        .from("property_image_versions")
        .select("id")
        .eq("property_id", propertyId)
        .eq("is_archived", false)
        .order("version_number", { ascending: false })
        .limit(1)
        .single();

      if (versionError || !currentVersion) {
        // If no version exists, just clear the thumbnail_url
        const { error: updateError } = await supabase
          .from("properties")
          .update({ thumbnail_url: null })
          .eq("id", propertyId);

        if (updateError) throw updateError;
      } else {
        // Archive the version
        const { error: archiveError } = await supabase.rpc(
          "archive_property_image_version",
          {
            p_property_id: propertyId,
            p_version_id: currentVersion.id,
          }
        );

        if (archiveError) throw archiveError;

        // Clear thumbnail_url
        const { error: updateError } = await supabase
          .from("properties")
          .update({ thumbnail_url: null })
          .eq("id", propertyId);

        if (updateError) throw updateError;
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["property", propertyId] });
      onImageUpdated?.();

      setShowArchiveDialog(false);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error archiving image:", error);
      alert(`Failed to archive image: ${error.message}`);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !propertyId || !orgId) return;

    setIsReplacing(true);
    try {
      // Generate file paths
      const fileExt = file.name.split(".").pop();
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(7);
      const newPath = `${orgId}/${propertyId}/${timestamp}-${randomStr}.${fileExt}`;

      // Upload new image
      const { error: uploadError } = await supabase.storage
        .from("property-images")
        .upload(newPath, file, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("property-images")
        .getPublicUrl(newPath);

      // Generate thumbnail using process-image function
      const { data: processData, error: processError } = await supabase.functions.invoke(
        "process-image",
        {
          body: {
            bucket: "property-images",
            path: newPath,
            recordId: propertyId,
            table: "properties",
          },
        }
      );

      if (processError) {
        console.error("Error processing thumbnail:", processError);
        // Continue anyway
      }

      // Call replace_property_image RPC
      const { error: replaceError } = await supabase.rpc("replace_property_image", {
        p_property_id: propertyId,
        p_new_storage_path: urlData.publicUrl,
        p_new_thumbnail_path: processData?.data?.thumbnailUrl || urlData.publicUrl,
        p_annotation_summary: null,
      });

      if (replaceError) {
        throw replaceError;
      }

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      queryClient.invalidateQueries({ queryKey: ["property", propertyId] });
      onImageUpdated?.();

      setShowReplaceDialog(false);
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error replacing image:", error);
      alert(`Failed to replace image: ${error.message}`);
    } finally {
      setIsReplacing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Property Image</DialogTitle>
            <DialogDescription>View, archive, or replace the property image</DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="view" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="view">View</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="view" className="space-y-4">
              {/* Image Display */}
              <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden">
                <img
                  src={imageUrl}
                  alt="Property"
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setShowReplaceDialog(true)}
                  disabled={isReplacing}
                  className="flex-1"
                >
                  <Replace className="h-4 w-4 mr-2" />
                  {isReplacing ? "Replacing..." : "Replace"}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => setShowArchiveDialog(true)}
                  disabled={isArchiving}
                  className="flex-1"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  {isArchiving ? "Archiving..." : "Archive"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <ImageHistory propertyId={propertyId} />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Image</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive this image? The original will be preserved in the history, but the image will be removed from the property profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={isArchiving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isArchiving ? "Archiving..." : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Replace File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleReplace}
        className="hidden"
      />
    </>
  );
}

// Image History Component
function ImageHistory({ propertyId }: { propertyId: string }) {
  const [versions, setVersions] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      try {
        // Load versions
        const { data: versionsData, error: versionsError } = await supabase
          .from("property_image_versions")
          .select("*")
          .eq("property_id", propertyId)
          .order("version_number", { ascending: false });

        if (versionsError) throw versionsError;

        // Load actions
        const { data: actionsData, error: actionsError } = await supabase
          .from("property_image_actions")
          .select("*")
          .eq("property_id", propertyId)
          .order("created_at", { ascending: false })
          .limit(20);

        if (actionsError) throw actionsError;

        setVersions(versionsData || []);
        setActions(actionsData || []);
      } catch (error) {
        console.error("Error loading history:", error);
      } finally {
        setLoading(false);
      }
    }

    if (propertyId) {
      loadHistory();
    }
  }, [propertyId]);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading history...</div>;
  }

  if (actions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No image history available
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-[400px] overflow-y-auto">
      {actions.map((action) => (
        <div
          key={action.id}
          className="p-4 border border-border rounded-lg shadow-e1 bg-card"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="font-semibold capitalize">{action.action_type}</div>
              <div className="text-sm text-muted-foreground">
                {new Date(action.created_at).toLocaleString()}
              </div>
              {action.metadata && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {action.metadata.annotation_summary && (
                    <div>Summary: {action.metadata.annotation_summary}</div>
                  )}
                  {action.metadata.version_number && (
                    <div>Version: {action.metadata.version_number}</div>
                  )}
                </div>
              )}
            </div>
            <History className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      ))}
    </div>
  );
}

