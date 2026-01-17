import { useMemo } from "react";
import { useSupabase } from "@/integrations/supabase/useSupabase";
import { useQuery } from "@tanstack/react-query";
import { useActiveOrg } from "@/hooks/useActiveOrg";
import { SpaceGroupCard } from "./SpaceGroupCard";
import { Skeleton } from "@/components/ui/skeleton";

interface PropertySpacesSectionProps {
  propertyId: string;
}

// Space group definitions with descriptions
const SPACE_GROUPS = [
  {
    name: "Circulation",
    description: "Corridors, hallways, staircases, and other movement areas that connect spaces throughout the property.",
    color: "#8EC9CE",
  },
  {
    name: "Habitable / Working",
    description: "Living, working, and activity spaces including bedrooms, offices, meeting rooms, and sales floors.",
    color: "#A8D5BA",
  },
  {
    name: "Service Areas",
    description: "Support spaces like kitchens, break areas, utility rooms, and staff facilities.",
    color: "#F4A261",
  },
  {
    name: "Sanitary Spaces",
    description: "Bathrooms, WCs, showers, changing rooms, and other hygiene facilities.",
    color: "#E76F51",
  },
  {
    name: "Storage",
    description: "Storage rooms, stock rooms, archives, cupboards, and other spaces for keeping items.",
    color: "#D4A574",
  },
  {
    name: "Technical / Plant",
    description: "Plant rooms, server rooms, electrical rooms, boiler rooms, and mechanical infrastructure spaces.",
    color: "#6C757D",
  },
  {
    name: "External Areas",
    description: "Outdoor spaces including gardens, terraces, car parks, loading bays, yards, and roof areas.",
    color: "#95A5A6",
  },
];

export function PropertySpacesSection({ propertyId }: PropertySpacesSectionProps) {
  const supabase = useSupabase();
  const { orgId } = useActiveOrg();

  // Fetch space types grouped by default_ui_group
  const { data: spaceTypes = [], isLoading: spaceTypesLoading } = useQuery({
    queryKey: ["space-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("space_types")
        .select("id, name, default_ui_group, functional_class")
        .order("default_ui_group");

      if (error) throw error;
      return data || [];
    },
    enabled: !!supabase,
  });

  // Fetch spaces for this property to count spaces per group
  const { data: spaces = [], isLoading: spacesLoading } = useQuery({
    queryKey: ["spaces", propertyId],
    queryFn: async () => {
      if (!orgId || !propertyId) return [];
      
      const { data, error } = await supabase
        .from("spaces")
        .select("id, space_type_id, name")
        .eq("property_id", propertyId)
        .eq("org_id", orgId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId && !!propertyId && !!supabase,
  });

  // Count spaces per group
  const spacesByGroup = useMemo(() => {
    const counts = new Map<string, number>();
    
    spaces.forEach((space) => {
      if (space.space_type_id) {
        const spaceType = spaceTypes.find(st => st.id === space.space_type_id);
        if (spaceType?.default_ui_group) {
          const current = counts.get(spaceType.default_ui_group) || 0;
          counts.set(spaceType.default_ui_group, current + 1);
        }
      }
    });
    
    return counts;
  }, [spaces, spaceTypes]);

  const isLoading = spaceTypesLoading || spacesLoading;

  if (isLoading) {
    return (
      <div className="relative w-full max-w-full overflow-x-hidden overflow-y-visible">
        <div className="overflow-x-auto overflow-y-hidden -ml-4 pl-4 pr-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent min-w-0">
          <div className="flex gap-3 items-start py-2" style={{ width: 'max-content' }}>
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="w-[175px] flex-shrink-0">
                <Skeleton className="h-[270px] rounded-[8px]" />
              </div>
            ))}
          </div>
        </div>
        {/* Gradient overlay - right side fade */}
        <div 
          className="absolute top-0 right-0 bottom-0 pointer-events-none"
          style={{
            width: '10px',
            background: 'linear-gradient(to right, transparent, rgba(0, 0, 0, 0.1))',
            zIndex: 20
          }}
        />
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-full overflow-x-hidden overflow-y-visible">
      <div className="overflow-x-auto overflow-y-hidden -ml-4 pl-4 pr-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent min-w-0">
        <div className="flex gap-3 items-start py-2" style={{ width: 'max-content' }}>
          {SPACE_GROUPS.map((group) => {
            const spaceCount = spacesByGroup.get(group.name) || 0;
            return (
              <div key={group.name} className="w-[175px] flex-shrink-0">
                <SpaceGroupCard
                  groupName={group.name}
                  description={group.description}
                  color={group.color}
                  spaceCount={spaceCount}
                  propertyId={propertyId}
                />
              </div>
            );
          })}
        </div>
      </div>
      {/* Gradient overlay - right side fade */}
      <div 
        className="absolute top-0 right-0 bottom-0 pointer-events-none"
        style={{
          width: '10px',
          background: 'linear-gradient(to right, transparent, rgba(0, 0, 0, 0.1))',
          zIndex: 20
        }}
      />
    </div>
  );
}
