/**
 * Partition property assets by space_id — parallel to rooms-by-area.
 * Unassigned assets have a null space_id.
 */

export type AssetLike = {
  id: string | null;
  name: string | null;
  space_id?: string | null;
};

export function partitionAssetsBySpace<T extends AssetLike>(assets: T[]) {
  const assetsBySpaceId: Record<string, T[]> = {};
  const unassigned: T[] = [];

  for (const asset of assets) {
    if (!asset.id) continue;
    const spaceId = asset.space_id ?? null;
    if (!spaceId) {
      unassigned.push(asset);
      continue;
    }
    if (!assetsBySpaceId[spaceId]) assetsBySpaceId[spaceId] = [];
    assetsBySpaceId[spaceId].push(asset);
  }

  return { assetsBySpaceId, unassigned };
}

export function assetCountsBySpaceId<T extends AssetLike>(
  assets: T[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const asset of assets) {
    const spaceId = asset.space_id ?? null;
    if (!spaceId) continue;
    counts[spaceId] = (counts[spaceId] ?? 0) + 1;
  }
  return counts;
}
