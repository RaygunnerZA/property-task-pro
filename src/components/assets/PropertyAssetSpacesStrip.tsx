/**
 * Spaces + asset chips strip for the Assets organisation screen.
 * Mirrors Spaces “Your areas” / “{AREA} SPACES”: assets nest under spaces
 * via assets.space_id using the shared onboardingAreasDnd kit.
 */

import {
  SortableContext,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ExpandableAssetChip, SemanticChip } from "@/components/chips/semantic";
import {
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Eye } from "lucide-react";
import {
  AREA_CHIP_NEUMO_RAISED,
  areaSpacesRowLabel,
  hexToRgba,
  shortAreaLabel,
  spaceAssetsRowLabel,
  type OnboardingArea,
} from "@/components/onboarding/onboardingPropertyAreas";
import {
  SortableItem,
  DroppableZone,
  spaceDroppableId,
  spaceAssetsListDroppableId,
  unassignedAssetsListDroppableId,
  assetSortableId,
  unassignedAssetSortableId,
} from "@/components/onboarding/onboardingAreasDnd";
import { shortSpaceLabel } from "@/components/onboarding/onboardingSpaceGroups";
import { cn } from "@/lib/utils";
import type { SpaceLike } from "@/lib/spaces/partitionPropertySpaces";
import type { AssetLike } from "@/lib/assets/partitionPropertyAssets";

const viewItemClassName = cn(
  "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5",
  "font-mono text-2xs uppercase tracking-wide",
  "min-h-0 focus:bg-accent"
);

type PropertyAssetSpacesStripProps = {
  areas: OnboardingArea[];
  viewingAreaId: string | null;
  activeSpaceId: string | null;
  roomsByAreaId: Record<string, SpaceLike[]>;
  unassignedRooms: SpaceLike[];
  rooms: SpaceLike[];
  assetsBySpaceId: Record<string, AssetLike[]>;
  unassignedAssets: AssetLike[];
  spaceColorById: Record<string, string>;
  onActivateArea: (areaId: string) => void;
  onActivateSpace: (spaceId: string) => void;
  onViewSpace: (spaceId: string) => void;
  onRemoveAsset: (name: string) => void;
  onRenameAsset: (name: string) => void;
  onViewAsset: (assetId: string) => void;
  onDuplicateAsset: (name: string) => void;
};

export function PropertyAssetSpacesStrip({
  areas,
  viewingAreaId,
  activeSpaceId,
  roomsByAreaId,
  unassignedRooms,
  rooms,
  assetsBySpaceId,
  unassignedAssets,
  spaceColorById,
  onActivateArea,
  onActivateSpace,
  onViewSpace,
  onRemoveAsset,
  onRenameAsset,
  onViewAsset,
  onDuplicateAsset,
}: PropertyAssetSpacesStripProps) {
  const hasPlaces = areas.length > 0 || rooms.length > 0;
  if (!hasPlaces && unassignedAssets.length === 0) return null;

  const viewingArea = areas.find((a) => a.id === viewingAreaId) ?? null;
  const viewingRooms = viewingArea ? roomsByAreaId[viewingArea.id] ?? [] : [];
  const placeRooms = viewingArea
    ? viewingRooms
    : areas.length === 0
      ? rooms
      : unassignedRooms;
  const activeSpace =
    rooms.find((s) => s.id === activeSpaceId) ??
    areas.find((a) => a.id === activeSpaceId) ??
    null;
  const activeSpaceName = (activeSpace?.name ?? "Space").trim() || "Space";
  const spaceAssets = (activeSpaceId ? assetsBySpaceId[activeSpaceId] ?? [] : []).filter(
    (asset): asset is AssetLike & { id: string } => Boolean(asset.id)
  );

  return (
    <div className="space-y-3">
      {areas.length > 0 ? (
        <div>
          <p className="mb-2 font-mono text-2xs uppercase tracking-wide text-muted-foreground">
            Your areas
          </p>
          <div className="flex flex-wrap gap-[5px]">
            {areas.map((area) => {
              const count = (roomsByAreaId[area.id] ?? []).length;
              const isActive = viewingAreaId === area.id;
              return (
                <DroppableZone key={area.id} id={spaceDroppableId(area.id)} className="inline-flex max-w-full shrink-0 align-top">
                  <SemanticChip
                    epistemic="fact"
                    label={`${shortAreaLabel(area.name).toUpperCase()} · ${count}`}
                    color={isActive ? area.color : hexToRgba(area.color, 0.42)}
                    onPress={() => onActivateArea(area.id)}
                    dropdown
                    dropdownContent={
                      <DropdownMenuItem
                        onSelect={() => onViewSpace(area.id)}
                        className={viewItemClassName}
                      >
                        <Eye className="h-3 w-3 shrink-0" aria-hidden />
                        View
                      </DropdownMenuItem>
                    }
                    className={cn("!shadow-none", AREA_CHIP_NEUMO_RAISED)}
                  />
                </DroppableZone>
              );
            })}
          </div>
        </div>
      ) : null}

      {hasPlaces ? (
        <div>
          <p className="mb-2 font-mono text-2xs uppercase tracking-wide text-muted-foreground">
            {viewingArea ? areaSpacesRowLabel(viewingArea.name) : "Your spaces"}
          </p>
          <div className="flex min-h-[36px] flex-wrap gap-[5px] rounded-[8px] p-1">
            {placeRooms.length === 0 ? (
              <p className="px-1 py-1.5 text-xs text-muted-foreground">
                {viewingArea
                  ? "No rooms in this area yet. Drop assets onto the area chip, or add rooms on Spaces."
                  : "Add rooms on the Spaces screen, then drop assets onto them."}
              </p>
            ) : (
              placeRooms.map((space) => {
                const name = (space.name ?? "").trim() || "Space";
                const isActive = activeSpaceId === space.id;
                const color = spaceColorById[space.id] ?? "#8EC9CE";
                const count = (assetsBySpaceId[space.id] ?? []).length;
                return (
                  <DroppableZone key={space.id} id={spaceDroppableId(space.id)} className="inline-flex max-w-full shrink-0 align-top">
                    <SemanticChip
                      epistemic="fact"
                      label={`${shortSpaceLabel(name)}${count ? ` · ${count}` : ""}`}
                      color={isActive ? color : hexToRgba(color, 0.42)}
                      onPress={() => onActivateSpace(space.id)}
                      dropdown
                      dropdownContent={
                        <DropdownMenuItem
                          onSelect={() => onViewSpace(space.id)}
                          className={viewItemClassName}
                        >
                          <Eye className="h-3 w-3 shrink-0" aria-hidden />
                          View
                        </DropdownMenuItem>
                      }
                      className={cn("!shadow-none", AREA_CHIP_NEUMO_RAISED)}
                    />
                  </DroppableZone>
                );
              })
            )}
          </div>
        </div>
      ) : null}

      {activeSpaceId ? (
        <div>
          <p className="mb-2 font-mono text-2xs uppercase tracking-wide text-muted-foreground">
            {spaceAssetsRowLabel(activeSpaceName)}
          </p>
          <DroppableZone id={spaceAssetsListDroppableId()}>
            <SortableContext
              items={spaceAssets.map((a) => assetSortableId(a.id))}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex min-h-[36px] flex-wrap gap-[5px] rounded-[8px] p-1">
                {spaceAssets.length === 0 ? (
                  <p className="px-1 py-1.5 text-xs text-muted-foreground">
                    Drop assets here, or pick them from the cards above.
                  </p>
                ) : (
                  spaceAssets.map((asset) => {
                    const name = (asset.name ?? "").trim() || "Asset";
                    return (
                      <SortableItem
                        key={asset.id}
                        id={assetSortableId(asset.id)}
                        data={{
                          kind: "asset",
                          assetId: asset.id,
                          assetName: name,
                          spaceId: asset.space_id ?? activeSpaceId,
                        }}
                      >
                        <ExpandableAssetChip
                          label={name}
                          color={spaceColorById[activeSpaceId] ?? undefined}
                          onRemove={() => onRemoveAsset(name)}
                          onRename={() => onRenameAsset(name)}
                          onView={() => onViewAsset(asset.id)}
                          onDuplicate={() => onDuplicateAsset(name)}
                          className={cn("!shadow-none", AREA_CHIP_NEUMO_RAISED)}
                        />
                      </SortableItem>
                    );
                  })
                )}
              </div>
            </SortableContext>
          </DroppableZone>
        </div>
      ) : null}

      <div>
        <p className="mb-2 font-mono text-2xs uppercase tracking-wide text-muted-foreground">
          Unassigned assets
        </p>
        <p className="mb-2 text-xs text-muted-foreground">
          Drag onto a space chip to nest under that space.
        </p>
        <DroppableZone id={unassignedAssetsListDroppableId()}>
          <SortableContext
            items={unassignedAssets
              .filter((a): a is AssetLike & { id: string } => Boolean(a.id))
              .map((a) => unassignedAssetSortableId(a.id))}
            strategy={horizontalListSortingStrategy}
          >
            <div className="flex min-h-[36px] flex-wrap gap-[5px] rounded-[8px] p-1">
              {unassignedAssets.length === 0 ? (
                <p className="px-1 py-1.5 text-xs text-muted-foreground">
                  Drop here to unassign from a space.
                </p>
              ) : (
                unassignedAssets
                  .filter((asset): asset is AssetLike & { id: string } => Boolean(asset.id))
                  .map((asset) => {
                  const name = (asset.name ?? "").trim() || "Asset";
                  return (
                    <SortableItem
                      key={asset.id}
                      id={unassignedAssetSortableId(asset.id)}
                      data={{
                        kind: "unassigned-asset",
                        assetId: asset.id,
                        assetName: name,
                      }}
                    >
                      <ExpandableAssetChip
                        label={name}
                        onRemove={() => onRemoveAsset(name)}
                        onRename={() => onRenameAsset(name)}
                        onView={() => onViewAsset(asset.id)}
                        onDuplicate={() => onDuplicateAsset(name)}
                        className={cn("!shadow-none", AREA_CHIP_NEUMO_RAISED)}
                      />
                    </SortableItem>
                  );
                })
              )}
            </div>
          </SortableContext>
        </DroppableZone>
      </div>
    </div>
  );
}
