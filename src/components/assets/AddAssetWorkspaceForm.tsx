import type { RefObject } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Upload, X } from "lucide-react";
import { NeomorphicInput } from "@/components/design-system/NeomorphicInput";
import { AIIconColorPicker } from "@/components/ui/AIIconColorPicker";

const ASSET_TYPES = ["Boiler", "Appliance", "Vehicle", "HVAC", "Plumbing", "Electrical", "Other"];

type PendingFile = {
  id: string;
  file_url: string;
  thumbnail_url?: string;
  file_type: string;
  displayName: string;
  isImage: boolean;
};

type PropertyOption = { id: string; address?: string | null };
type SpaceOption = { id: string; name?: string | null };

export type AddAssetFormVariant = "rail" | "dialog";

export interface AddAssetWorkspaceFormProps {
  variant: AddAssetFormVariant;
  imageInputRef: RefObject<HTMLInputElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  isUploadingFile: boolean;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>, asImage: boolean) => void;
  pendingFiles: PendingFile[];
  onRemoveFile: (id: string) => void;
  name: string;
  onNameChange: (v: string) => void;
  type: string;
  onTypeChange: (v: string) => void;
  serial: string;
  onSerialChange: (v: string) => void;
  propertyId: string;
  onPropertyChange: (v: string) => void;
  properties: PropertyOption[];
  spaceId: string;
  onSpaceChange: (v: string) => void;
  formSpaces: SpaceOption[];
  conditionScore: string;
  onConditionScoreChange: (v: string) => void;
  iconName: string;
  onIconChange: (icon: string) => void;
  isSaving: boolean;
  onSave: () => void;
  onCancel?: () => void;
  /** Wide rail only — reset fields without closing */
  onRailReset?: () => void;
}

function idFor(base: string, variant: AddAssetFormVariant) {
  return variant === "rail" ? `${base}-rail` : `${base}-dlg`;
}

/**
 * Shared Add Asset body for the property workspace rail (wide) and dialog (narrow).
 */
export function AddAssetWorkspaceForm({
  variant,
  imageInputRef,
  fileInputRef,
  isUploadingFile,
  onFileSelect,
  pendingFiles,
  onRemoveFile,
  name,
  onNameChange,
  type,
  onTypeChange,
  serial,
  onSerialChange,
  propertyId,
  onPropertyChange,
  properties,
  spaceId,
  onSpaceChange,
  formSpaces,
  conditionScore,
  onConditionScoreChange,
  iconName,
  onIconChange,
  isSaving,
  onSave,
  onCancel,
  onRailReset,
}: AddAssetWorkspaceFormProps) {
  const I = (b: string) => idFor(b, variant);

  /** Match Report Issue / `ImageUploadSection` icon-only capture + upload controls */
  const uploadButtons = (
    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
      <button
        type="button"
        onClick={() => imageInputRef.current?.click()}
        disabled={isUploadingFile}
        title="Take photo"
        aria-label="Take photo"
        className="h-[35px] w-[35px] rounded-[8px] flex items-center justify-center bg-muted/60 shadow-e1 hover:shadow-e2 transition-all disabled:pointer-events-none disabled:opacity-50"
      >
        <Camera className="h-5 w-5 text-muted-foreground" />
      </button>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploadingFile}
        title="Upload file"
        aria-label="Upload file"
        className="h-[35px] w-[35px] rounded-[8px] flex items-center justify-center bg-muted/60 shadow-e1 hover:shadow-e2 transition-all disabled:pointer-events-none disabled:opacity-50"
      >
        <Upload className="h-5 w-5 text-muted-foreground" />
      </button>
    </div>
  );

  const pendingBlock =
    pendingFiles.length > 0 ? (
      <div className="flex flex-wrap gap-2 mt-3">
        {pendingFiles.map((f) => (
          <div
            key={f.id}
            className="relative group rounded-lg overflow-hidden bg-muted/50 border border-border/50"
          >
            {f.isImage ? (
              <img
                src={f.thumbnail_url || f.file_url}
                alt={f.displayName}
                className="w-14 h-14 object-cover"
              />
            ) : (
              <div className="w-14 h-14 flex items-center justify-center p-1">
                <span className="text-[10px] text-muted-foreground truncate text-center">
                  {f.displayName}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => onRemoveFile(f.id)}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              aria-label="Remove"
            >
              <X className="h-5 w-5 text-white" />
            </button>
          </div>
        ))}
      </div>
    ) : null;

  const fields = (
    <div className="space-y-4 py-1">
      <div className="space-y-2">
        <Label htmlFor={I("asset-name")}>Name *</Label>
        <NeomorphicInput
          id={I("asset-name")}
          placeholder="e.g., Main Boiler"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={I("asset-type")}>Type</Label>
        <Select value={type} onValueChange={onTypeChange}>
          <SelectTrigger id={I("asset-type")} className="input-neomorphic">
            <SelectValue placeholder="Select asset type" />
          </SelectTrigger>
          <SelectContent>
            {ASSET_TYPES.map((assetType) => (
              <SelectItem key={assetType} value={assetType}>
                {assetType}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={I("asset-serial")}>Serial Number</Label>
        <NeomorphicInput
          id={I("asset-serial")}
          placeholder="e.g., ABC123456"
          value={serial}
          onChange={(e) => onSerialChange(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={I("asset-property")}>Property *</Label>
        <Select value={propertyId} onValueChange={onPropertyChange}>
          <SelectTrigger id={I("asset-property")} className="input-neomorphic">
            <SelectValue placeholder="Select a property" />
          </SelectTrigger>
          <SelectContent>
            {properties.map((property) => (
              <SelectItem key={property.id} value={property.id}>
                {property.address}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {propertyId && (
        <div className="space-y-2">
          <Label htmlFor={I("asset-space")}>Space (Optional)</Label>
          <Select value={spaceId || "none"} onValueChange={onSpaceChange}>
            <SelectTrigger id={I("asset-space")} className="input-neomorphic">
              <SelectValue placeholder="Select a space (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {formSpaces.map((space) => (
                <SelectItem key={space.id} value={space.id}>
                  {space.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor={I("asset-condition")}>Condition Score (0-100)</Label>
        <NeomorphicInput
          id={I("asset-condition")}
          type="number"
          min={0}
          max={100}
          placeholder="100"
          value={conditionScore}
          onChange={(e) => onConditionScoreChange(e.target.value)}
        />
      </div>
      <AIIconColorPicker
        searchText={[name, type].filter(Boolean).join(" ").trim()}
        value={{ iconName, color: "#8EC9CE" }}
        onChange={(iname) => onIconChange(iname)}
        defaultIcons={["package", "box", "wrench", "plug", "cpu"]}
        fallbackSearch="asset"
        disabled={isSaving}
      />
    </div>
  );

  return (
    <>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFileSelect(e, true)}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={(e) => onFileSelect(e, false)}
      />

      {variant === "dialog" ? (
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle>Add Asset</DialogTitle>
              <DialogDescription>Register a new asset in your property registry</DialogDescription>
            </div>
            {uploadButtons}
          </div>
          {pendingBlock}
        </DialogHeader>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground tracking-tight">Add Asset</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Register a new asset in your property registry
              </p>
            </div>
            {uploadButtons}
          </div>
          {pendingBlock}
        </>
      )}

      {fields}

      {variant === "dialog" ? (
        <DialogFooter>
          <Button
            variant="outline"
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="input-neomorphic"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={isSaving || !propertyId || !name.trim()}
            className="btn-accent-vibrant"
          >
            {isSaving ? "Saving..." : "Save Asset"}
          </Button>
        </DialogFooter>
      ) : (
        <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-border/30 mt-4">
          {onRailReset ? (
            <Button
              type="button"
              variant="outline"
              onClick={onRailReset}
              disabled={isSaving}
              className="input-neomorphic"
            >
              Clear form
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={onSave}
            disabled={isSaving || !propertyId || !name.trim()}
            className="btn-accent-vibrant"
          >
            {isSaving ? "Saving..." : "Save Asset"}
          </Button>
        </div>
      )}
    </>
  );
}
