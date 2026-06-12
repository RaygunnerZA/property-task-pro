import { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  CUSTOM_COLLECTION_DEFAULT_LABEL,
  CUSTOM_COLLECTION_DESCRIPTION,
} from "./onboardingSpaceGroups";
import { SpaceGroupCardBanner } from "@/components/spaces/SpaceGroupCardBanner";
import { getSpaceGroupCardIllustration } from "@/lib/spaceGroupIllustrations";

const DASHED_LINE_STYLE = {
  height: "1px",
  backgroundImage:
    "repeating-linear-gradient(to right, #E2DBCB 0px, #E2DBCB 4px, transparent 4px, transparent 7px)",
  backgroundSize: "7px 1px",
  backgroundRepeat: "repeat-x" as const,
};

const INLINE_INPUT_CLASS = cn(
  "min-w-0 flex-1 rounded-lg bg-[#F6F4F2] px-2.5 py-1.5",
  "font-mono text-[11px] uppercase tracking-wide text-foreground",
  "placeholder:text-[#6D7480]/60 outline-none",
  "focus:ring-2 focus:ring-[#8EC9CE]/40"
);

const INLINE_INPUT_SHADOW = {
  boxShadow:
    "inset 2px 2px 4px rgba(0,0,0,0.08), inset -2px -2px 4px rgba(255,255,255,0.7)",
} as const;

interface OnboardingCustomCollectionDraftCardProps {
  onCreateCollection: (name: string) => void;
  className?: string;
}

/** Empty slot for naming a new custom collection; spawns a filled card to its left on create. */
export function OnboardingCustomCollectionDraftCard({
  onCreateCollection,
  className,
}: OnboardingCustomCollectionDraftCardProps) {
  const [collectionName, setCollectionName] = useState("");

  const handleCreate = () => {
    const trimmed = collectionName.trim();
    if (!trimmed) return;
    onCreateCollection(trimmed);
    setCollectionName("");
  };

  return (
    <div className={cn("w-[200px] h-[272px] flex-shrink-0", className)}>
      <div className="relative flex h-full flex-col overflow-hidden rounded-[8px] bg-card shadow-e1">
        <div className="h-[130px] shrink-0 overflow-hidden">
          <SpaceGroupCardBanner
            imageSrc={getSpaceGroupCardIllustration("custom")}
            alt={CUSTOM_COLLECTION_DEFAULT_LABEL}
            color="#E8DFD0"
            className="h-full"
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-3 pb-2 pt-2">
          <div className="shrink-0 space-y-2">
            <h3 className="text-lg font-semibold leading-tight text-foreground line-clamp-1">
              {CUSTOM_COLLECTION_DEFAULT_LABEL}
            </h3>
            <div className="-ml-1 -mr-1 pt-1" style={DASHED_LINE_STYLE} />
          </div>

          <p className="mt-[5px] line-clamp-4 h-[72px] max-h-24 text-xs leading-[18px] text-muted-foreground">
            {CUSTOM_COLLECTION_DESCRIPTION}
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
              className={INLINE_INPUT_CLASS}
              style={INLINE_INPUT_SHADOW}
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={!collectionName.trim()}
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition-all",
                "disabled:opacity-50"
              )}
              style={{ backgroundColor: "#14B8A6" }}
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
