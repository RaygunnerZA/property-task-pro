import { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import {
  CUSTOM_ASSET_COLLECTION_DEFAULT_LABEL,
  CUSTOM_ASSET_COLLECTION_DESCRIPTION,
} from "./onboardingAssetGroups";
import { SpaceGroupCardBanner } from "@/components/spaces/SpaceGroupCardBanner";
import { getAssetGroupCardIllustration } from "@/lib/assetGroupIllustrations";
import {
  SPACE_GROUP_ADD_INPUT_CLASS,
  SPACE_GROUP_ADD_INPUT_SHADOW,
} from "./spaceGroupCardInputStyles";

const DASHED_LINE_STYLE = {
  height: "1px",
  backgroundImage:
    "repeating-linear-gradient(to right, hsl(var(--border)) 0px, hsl(var(--border)) 4px, transparent 4px, transparent 7px)",
  backgroundSize: "7px 1px",
  backgroundRepeat: "repeat-x" as const,
};

interface OnboardingAssetCustomCollectionDraftCardProps {
  onCreateCollection: (name: string) => void;
  className?: string;
}

export function OnboardingAssetCustomCollectionDraftCard({
  onCreateCollection,
  className,
}: OnboardingAssetCustomCollectionDraftCardProps) {
  const [collectionName, setCollectionName] = useState("");

  const handleCreate = () => {
    const trimmed = collectionName.trim();
    if (!trimmed) return;
    onCreateCollection(trimmed);
    setCollectionName("");
  };

  return (
    <div className={cn("w-[200px] h-[272px] flex-shrink-0", className)}>
      <div className="relative flex h-full flex-col overflow-hidden rounded-card bg-card shadow-e1">
        <div className="h-[130px] shrink-0 overflow-hidden">
          <SpaceGroupCardBanner
            imageSrc={getAssetGroupCardIllustration("custom")}
            alt={CUSTOM_ASSET_COLLECTION_DEFAULT_LABEL}
            color="#E8DFD0"
            className="h-full"
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-3 pb-2 pt-2">
          <div className="shrink-0 space-y-2">
            <h3 className="text-lg font-semibold leading-tight text-foreground line-clamp-1">
              {CUSTOM_ASSET_COLLECTION_DEFAULT_LABEL}
            </h3>
            <div className="-ml-1 -mr-1 pt-1" style={DASHED_LINE_STYLE} />
          </div>

          <p className="mt-[5px] line-clamp-4 h-[72px] max-h-24 text-xs leading-[18px] text-muted-foreground">
            {CUSTOM_ASSET_COLLECTION_DESCRIPTION}
          </p>

          <div className="mt-auto flex w-full shrink-0 items-center gap-1.5 pt-1">
            <input
              type="text"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              placeholder="Collection name"
              className={SPACE_GROUP_ADD_INPUT_CLASS}
              style={SPACE_GROUP_ADD_INPUT_SHADOW}
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={!collectionName.trim()}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition-all",
                "disabled:opacity-50"
              )}
              style={{ backgroundColor: "hsl(var(--primary-deep))" }}
              aria-label="Create collection"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
