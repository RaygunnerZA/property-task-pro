import { CollectionShelfCard } from "@/components/organise/CollectionShelfCard";
import {
  explorerCategoryDescription,
  explorerCategoryLabel,
  type ExplorerCategoryId,
} from "@/lib/records/explorerFilters";
import { getRecordGroupCardIllustration } from "@/lib/records/recordGroupIllustrations";
import { getRecordGroup, type RecordGroupId } from "@/lib/records/recordGroups";
import { CENTRE_WORKBENCH_TAB_META } from "@/lib/centreWorkbenchTabs";

const ALL_RECORDS_ILLUSTRATION = CENTRE_WORKBENCH_TAB_META.records.illustrationSrc;

type RecordsExplorerCategoryCardProps = {
  categoryId: ExplorerCategoryId;
  count: number;
  attentionCount?: number;
  selected?: boolean;
  onSelect: () => void;
  className?: string;
};

function categoryColor(id: ExplorerCategoryId): string {
  if (id === "all") return "#C4A35A";
  return getRecordGroup(id as RecordGroupId)?.color ?? "#8EC9CE";
}

function categoryImage(id: ExplorerCategoryId): string {
  if (id === "all") return ALL_RECORDS_ILLUSTRATION;
  return getRecordGroupCardIllustration(id as RecordGroupId);
}

/**
 * Records shelf card — maps explorer categories onto the shared
 * CollectionShelfCard (shelf–bench–drawer grammar, @Docs/04_UI_System.md).
 */
export function RecordsExplorerCategoryCard({
  categoryId,
  count,
  attentionCount = 0,
  selected = false,
  onSelect,
  className,
}: RecordsExplorerCategoryCardProps) {
  return (
    <CollectionShelfCard
      label={explorerCategoryLabel(categoryId)}
      description={explorerCategoryDescription(categoryId)}
      imageSrc={categoryImage(categoryId)}
      color={categoryColor(categoryId)}
      count={count}
      countNoun="document"
      attentionCount={attentionCount}
      attentionLabel="need attention"
      selected={selected}
      onSelect={onSelect}
      className={className}
    />
  );
}
