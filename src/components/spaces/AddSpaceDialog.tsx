import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/useDebounce";
import { resolveToCanonicalSpaceType } from "@/config/spaceTypeAliases";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SpaceVisualPicker,
  type SpaceVisualValue,
} from "@/components/spaces/SpaceVisualPicker";
import { getAssetIcon } from "@/lib/icon-resolver";
import { toast } from "sonner";
import { resolveSpaceMiniCardIllustration } from "@/lib/spaceTypeIllustrations";
import { getSuggestedCopyName } from "@/lib/spaceNameUtils";
import { uploadSpaceImage, validateSpaceImageFile } from "@/services/spaces/spaceImageUpload";
import { Copy, ExternalLink } from "lucide-react";

type CreatedSpace = { id: string; name: string; icon_name: string };

const DEFAULT_VISUAL: SpaceVisualValue = {
  mode: "thumbnail",
  thumbnailUrl: null,
  iconName: "",
  iconColor: "#8EC9CE",
};

interface AddSpaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties?: any[];
  propertyId?: string;
  /** "modal" = dialog overlay; "column" = inline in third column concertina */
  variant?: "modal" | "column";
  /** When true with variant="column", render only content (concertina provides header) */
  headless?: boolean;
  /** Called after a space is successfully created */
  onCreated?: (space: CreatedSpace) => void;
  /**
   * When the typed name matches an existing space, prefer selecting it in-place
   * (intake / task create) instead of navigating to the space detail page.
   */
  onSelectExisting?: (space: CreatedSpace) => void;
  /** Pre-fill the space name input */
  initialName?: string;
}

export function AddSpaceDialog({
  open,
  onOpenChange,
  properties = [],
  propertyId: initialPropertyId,
  variant = "modal",
  headless = false,
  onCreated,
  onSelectExisting,
  initialName = "",
}: AddSpaceDialogProps) {
  const { orgId } = useActiveOrg();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState(initialName);
  const [propertyId, setPropertyId] = useState<string>(initialPropertyId || "");
  const [visual, setVisual] = useState<SpaceVisualValue>(DEFAULT_VISUAL);
  const [visualTouched, setVisualTouched] = useState(false);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const pendingObjectUrlRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);

  const debouncedName = useDebounce(name.trim(), 400);
  const canonicalName = resolveToCanonicalSpaceType(name) ?? debouncedName;
  const dialogActive = open || variant === "column";

  const { data: spaceTypeMatch } = useQuery({
    queryKey: ["space-types", "icon-lookup", canonicalName],
    queryFn: async () => {
      if (!canonicalName) return null;
      const { data, error } = await supabase
        .from("space_types")
        .select("id, name, default_icon")
        .ilike("name", canonicalName)
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!canonicalName && dialogActive,
  });

  const { data: propertySpaces = [] } = useQuery({
    queryKey: ["spaces", "name-index", orgId, propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("spaces")
        .select("id, name, icon_name")
        .eq("org_id", orgId!)
        .eq("property_id", propertyId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId && !!propertyId && dialogActive,
  });

  const existingMatch = debouncedName
    ? propertySpaces.find(
        (space) => (space.name ?? "").trim().toLowerCase() === debouncedName.toLowerCase()
      ) ?? null
    : null;

  const suggestedCopyName = existingMatch
    ? getSuggestedCopyName(
        existingMatch.name,
        propertySpaces.map((space) => space.name ?? "")
      )
    : null;

  const suggestedIcon = spaceTypeMatch?.default_icon ?? null;
  const selectExistingInPlace = typeof onSelectExisting === "function";

  const resetForm = useCallback(() => {
    setName("");
    if (!initialPropertyId) {
      setPropertyId("");
    }
    if (pendingObjectUrlRef.current) {
      URL.revokeObjectURL(pendingObjectUrlRef.current);
      pendingObjectUrlRef.current = null;
    }
    setPendingUploadFile(null);
    setVisual(DEFAULT_VISUAL);
    setVisualTouched(false);
  }, [initialPropertyId]);

  const handleUploadForCreate = useCallback(async (file: File) => {
    validateSpaceImageFile(file);
    if (pendingObjectUrlRef.current) {
      URL.revokeObjectURL(pendingObjectUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(file);
    pendingObjectUrlRef.current = objectUrl;
    setPendingUploadFile(file);
    return objectUrl;
  }, []);

  const createSpaceWithName = async (spaceName: string) => {
    if (!orgId || !propertyId) return;

    const trimmed = spaceName.trim();
    if (!trimmed) {
      toast.error("Space name is required");
      return;
    }

    const collision = propertySpaces.find(
      (space) => (space.name ?? "").trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (collision) {
      toast.error(`“${collision.name}” already exists in this property`);
      return;
    }

    setLoading(true);
    try {
      const effectiveIcon =
        visual.iconName || suggestedIcon || "box";
      let thumbnailUrl: string | null =
        visual.mode === "thumbnail" && visual.thumbnailUrl && !pendingUploadFile
          ? visual.thumbnailUrl
          : visual.mode === "icon"
            ? null
            : resolveSpaceMiniCardIllustration(
                spaceTypeMatch?.name ?? (canonicalName || trimmed)
              );

      const { data: newSpace, error: createError } = await supabase
        .from("spaces")
        .insert({
          org_id: orgId,
          property_id: propertyId,
          name: trimmed,
          icon_name: effectiveIcon,
          space_type_id: spaceTypeMatch?.id ?? null,
          thumbnail_url: thumbnailUrl,
        })
        .select()
        .single();

      if (createError) {
        console.error("Space creation error:", createError);
        throw createError;
      }

      if (pendingUploadFile) {
        const uploaded = await uploadSpaceImage(supabase, {
          orgId,
          propertyId,
          file: pendingUploadFile,
          spaceId: newSpace.id,
        });
        thumbnailUrl = uploaded.displayUrl;
      }

      toast.success("Space created!");
      onCreated?.({ id: newSpace.id, name: newSpace.name, icon_name: newSpace.icon_name });
      resetForm();
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
    } catch (err: unknown) {
      console.error("Create space failed:", err);
      const message = err instanceof Error ? err.message : "Failed to create space";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Space name is required");
      return;
    }

    if (!propertyId) {
      toast.error("Please select a property");
      return;
    }

    if (!orgId) {
      toast.error("Organisation not found");
      return;
    }

    if (existingMatch) {
      toast.message(`“${existingMatch.name}” already exists — open it or create a copy.`);
      return;
    }

    await createSpaceWithName(name);
  };

  const handleUseExisting = () => {
    if (!existingMatch || !propertyId) return;

    const space: CreatedSpace = {
      id: existingMatch.id,
      name: existingMatch.name,
      icon_name: existingMatch.icon_name || "box",
    };

    if (selectExistingInPlace) {
      onSelectExisting?.(space);
      resetForm();
      onOpenChange(false);
      return;
    }

    onOpenChange(false);
    navigate(`/properties/${propertyId}/spaces/${space.id}`);
  };

  const handleCreateCopy = async () => {
    if (!suggestedCopyName) return;
    setName(suggestedCopyName);
    await createSpaceWithName(suggestedCopyName);
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onOpenChange(false);
    }
  };

  useEffect(() => {
    if (initialPropertyId) {
      setPropertyId(initialPropertyId);
    }
  }, [initialPropertyId]);

  useEffect(() => {
    if (open && initialName) {
      setName(initialName);
    }
  }, [open, initialName]);

  // Auto-suggest gallery art when the name resolves and the user hasn't chosen a visual yet.
  useEffect(() => {
    if (visualTouched) return;
    if (visual.mode === "icon") return;
    if (pendingUploadFile) return;
    const auto = resolveSpaceMiniCardIllustration(
      spaceTypeMatch?.name ?? (canonicalName || name.trim())
    );
    if (!auto) return;
    if (visual.thumbnailUrl === auto) return;
    setVisual((prev) => ({
      ...prev,
      mode: "thumbnail",
      thumbnailUrl: auto,
      iconName: prev.iconName || suggestedIcon || "",
    }));
  }, [
    canonicalName,
    name,
    pendingUploadFile,
    spaceTypeMatch?.name,
    suggestedIcon,
    visual.mode,
    visual.thumbnailUrl,
    visualTouched,
  ]);

  const ExistingIcon = getAssetIcon(existingMatch?.icon_name || "box");

  const formContent = (
    <div className="space-y-6 p-4">
      <SpaceVisualPicker
        value={{
          ...visual,
          iconName: visual.iconName || suggestedIcon || "box",
        }}
        onChange={(next) => {
          setVisualTouched(true);
          if (next.mode === "icon" || (next.thumbnailUrl && !next.thumbnailUrl.startsWith("blob:"))) {
            setPendingUploadFile(null);
            if (pendingObjectUrlRef.current) {
              URL.revokeObjectURL(pendingObjectUrlRef.current);
              pendingObjectUrlRef.current = null;
            }
          }
          setVisual(next);
        }}
        searchText={name}
        suggestedIcon={suggestedIcon}
        disabled={loading}
        onUploadFile={handleUploadForCreate}
      />

      {/* Property Selection - Hide if propertyId is pre-selected */}
      {!initialPropertyId && (
        <div className="grid gap-2">
          <Label htmlFor="property">Property *</Label>
          <Select value={propertyId} onValueChange={setPropertyId} disabled={loading}>
            <SelectTrigger id="property">
              <SelectValue placeholder="Select a property" />
            </SelectTrigger>
            <SelectContent>
              {properties.map((property) => (
                <SelectItem key={property.id} value={property.id}>
                  {property.nickname || property.address || "Unnamed Property"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {properties.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No properties available. Please create a property first.
            </p>
          )}
        </div>
      )}

      {/* Space Name */}
      <div className="grid gap-2">
        <Label htmlFor="name">Space name *</Label>
        <Input
          id="name"
          placeholder="e.g. Kitchen, Bedroom, Office"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          aria-invalid={!!existingMatch}
        />

        {existingMatch && suggestedCopyName ? (
          <div
            className="rounded-xl bg-card/80 p-3 shadow-e1"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 shadow-sm">
                <ExistingIcon className="h-4 w-4 text-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  “{existingMatch.name}” already exists
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Open the existing space, or create “{suggestedCopyName}”.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleUseExisting}
                    disabled={loading}
                    className="gap-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {selectExistingInPlace
                      ? `Use ${existingMatch.name}`
                      : `Open ${existingMatch.name}`}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleCreateCopy()}
                    disabled={loading}
                    className="gap-1.5"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {loading ? "Creating…" : `Create ${suggestedCopyName}`}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex gap-2 pt-2">
        <Button
          variant="outline"
          onClick={handleClose}
          disabled={loading}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          onClick={() => void handleSave()}
          disabled={
            loading ||
            !!existingMatch ||
            !name.trim() ||
            !propertyId ||
            (!initialPropertyId && properties.length === 0)
          }
          className="flex-1"
        >
          {loading ? "Creating…" : "Create Space"}
        </Button>
      </div>
    </div>
  );

  if (variant === "column" && headless) {
    return <>{formContent}</>;
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Space</DialogTitle>
          <DialogDescription>
            Enter the space details below. Spaces help organize tasks within properties.
          </DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
