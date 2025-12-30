import { useMemo, useState, useEffect } from "react";
import { useThemes } from "@/hooks/useThemes";
import { useTasksQuery } from "@/hooks/useTasksQuery";
import { usePropertiesQuery } from "@/hooks/usePropertiesQuery";
import { useAssetsQuery } from "@/hooks/useAssetsQuery";
import { useSpaces } from "@/hooks/useSpaces";
import { supabase } from "@/integrations/supabase/client";
import { AssetCard } from "./AssetCard";
import { FilterBar, type FilterOption, type FilterGroup } from "@/components/ui/filters/FilterBar";
import { AlertTriangle, CheckSquare, TrendingDown, Tag, FileCheck } from "lucide-react";
import { LoadingState } from "@/components/design-system/LoadingState";
import { EmptyState } from "@/components/design-system/EmptyState";
import { Package } from "lucide-react";

interface AssetListProps {
  propertyId?: string;
}

export function AssetList({ propertyId }: AssetListProps = {}) {
  const { data: assetsData = [], isLoading: loading, error } = useAssetsQuery(propertyId);
  const { themes } = useThemes();
  const { data: tasks = [] } = useTasksQuery(propertyId);
  const { data: properties = [] } = usePropertiesQuery();
  const [selectedFilters, setSelectedFilters] = useState<Set<string>>(new Set());
  const [assetThemes, setAssetThemes] = useState<Map<string, string[]>>(new Map()); // asset_id -> theme_ids
  
  // Assets are already filtered by property_id from the query
  const propertyAssets = assetsData;

  // Fetch asset themes (assets_view doesn't include themes yet)
  useEffect(() => {
    if (propertyAssets.length === 0) {
      setAssetThemes(new Map());
      return;
    }

    const fetchAssetThemes = async () => {
      const assetIds = propertyAssets.map(a => a.id);
      const { data } = await supabase
        .from("asset_themes")
        .select("asset_id, theme_id")
        .in("asset_id", assetIds);

      if (data) {
        const themeMap = new Map<string, string[]>();
        data.forEach((at: any) => {
          if (!themeMap.has(at.asset_id)) {
            themeMap.set(at.asset_id, []);
          }
          themeMap.get(at.asset_id)!.push(at.theme_id);
        });
        setAssetThemes(themeMap);
      }
    };

    fetchAssetThemes();
  }, [propertyAssets]);

  // Get tasks for assets - assets_view includes open_tasks_count
  const assetTasks = useMemo(() => {
    const taskMap = new Map<string, number>(); // asset_id -> count of open tasks
    propertyAssets.forEach((asset: any) => {
      if (asset.open_tasks_count) {
        taskMap.set(asset.id, asset.open_tasks_count);
      }
    });
    return taskMap;
  }, [propertyAssets]);

  // Create property and space maps
  const propertyMap = useMemo(() => {
    return new Map(properties.map((p) => [p.id, p.nickname || p.address]));
  }, [properties]);

  // Filter assets based on selected filters
  const filteredAssets = useMemo(() => {
    let filtered = [...propertyAssets];

    // Primary filters
    if (selectedFilters.has("filter-critical")) {
      filtered = filtered.filter((asset) => (asset.condition_score ?? 100) < 60);
    }

    if (selectedFilters.has("filter-has-open-tasks")) {
      filtered = filtered.filter((asset) => (assetTasks.get(asset.id) || 0) > 0);
    }

    if (selectedFilters.has("filter-poor")) {
      filtered = filtered.filter((asset) => (asset.condition_score ?? 100) < 40);
    }

    // Secondary filters - Theme
    const themeFilterIds = Array.from(selectedFilters).filter(f => f.startsWith("filter-theme-"));
    if (themeFilterIds.length > 0) {
      const selectedThemeIds = themeFilterIds.map(f => f.replace("filter-theme-", ""));
      filtered = filtered.filter((asset) => {
        const assetThemeIds = assetThemes.get(asset.id) || [];
        return selectedThemeIds.some(themeId => assetThemeIds.includes(themeId));
      });
    }

    // Secondary filters - Warranty (simplified - check if warranty_date exists and is valid)
    if (selectedFilters.has("filter-warranty-valid")) {
      filtered = filtered.filter((asset) => {
        const warrantyDate = (asset as any).warranty_date;
        if (!warrantyDate) return false;
        return new Date(warrantyDate) > new Date();
      });
    }

    if (selectedFilters.has("filter-warranty-expired")) {
      filtered = filtered.filter((asset) => {
        const warrantyDate = (asset as any).warranty_date;
        if (!warrantyDate) return false;
        return new Date(warrantyDate) <= new Date();
      });
    }

    return filtered;
  }, [propertyAssets, selectedFilters, assetTasks, assetThemes]);

  // Filter options
  const primaryOptions: FilterOption[] = [
    {
      id: "filter-critical",
      label: "Critical",
      icon: <AlertTriangle className="h-3 w-3" />,
      color: "#EB6834", // Accent color
    },
    {
      id: "filter-has-open-tasks",
      label: "Has Open Tasks",
      icon: <CheckSquare className="h-3 w-3" />,
    },
    {
      id: "filter-poor",
      label: "Poor",
      icon: <TrendingDown className="h-3 w-3" />,
      color: "#EB6834", // Accent color
    },
  ];

  const secondaryGroups: FilterGroup[] = [
    {
      id: "theme",
      label: "Theme",
      options: themes.map((theme) => ({
        id: `filter-theme-${theme.id}`,
        label: theme.name,
        icon: <Tag className="h-3 w-3" />,
        color: theme.color || undefined,
      })),
    },
    {
      id: "warranty",
      label: "Warranty",
      options: [
        {
          id: "filter-warranty-valid",
          label: "Valid",
          icon: <FileCheck className="h-3 w-3" />,
        },
        {
          id: "filter-warranty-expired",
          label: "Expired",
          icon: <FileCheck className="h-3 w-3" />,
        },
      ],
    },
  ];

  const handleFilterChange = (filterId: string, selected: boolean) => {
    setSelectedFilters((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(filterId);
      } else {
        next.delete(filterId);
      }
      return next;
    });
  };

  if (loading) {
    return <LoadingState message="Loading assets..." />;
  }

  if (error) {
    return <EmptyState title="Unable to load assets" subtitle={error?.message || String(error)} />;
  }

  if (propertyAssets.length === 0) {
    return (
      <EmptyState
        title="No assets"
        subtitle="Create your first asset using the + button"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <FilterBar
        primaryOptions={primaryOptions}
        secondaryGroups={secondaryGroups}
        selectedFilters={selectedFilters}
        onFilterChange={handleFilterChange}
      />

      {/* Assets Grid */}
      {filteredAssets.length === 0 ? (
        <EmptyState
          title="No assets match filters"
          subtitle="Try adjusting your filters"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map((asset) => {
            // assets_view includes property_name and space_name
            const propertyName = (asset as any).property_name || (asset.property_id
              ? propertyMap.get(asset.property_id)
              : undefined);
            const spaceName = (asset as any).space_name;

            return (
              <AssetCard
                key={asset.id}
                asset={asset}
                propertyName={propertyName}
                spaceName={spaceName}
                onClick={() => {
                  // Navigate to asset detail when implemented
                  // navigate(`/assets/${asset.id}`);
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

