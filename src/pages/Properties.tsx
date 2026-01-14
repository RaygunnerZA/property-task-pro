import { usePropertiesQuery } from '@/hooks/usePropertiesQuery';
import { Building2, Plus, Home, Hotel, Warehouse, Store, Castle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { PropertyCard } from '@/components/properties/PropertyCard';
import { AddPropertyDialog } from '@/components/properties/AddPropertyDialog';
import { StandardPage } from '@/components/design-system/StandardPage';
import { NeomorphicButton } from '@/components/design-system/NeomorphicButton';
import { EmptyState } from '@/components/design-system/EmptyState';
import { LoadingState } from '@/components/design-system/LoadingState';

const Properties = () => {
  const { data: properties = [], isLoading: loading } = usePropertiesQuery();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);

  // Property icon mapping
  const PROPERTY_ICONS = {
    home: Home,
    building: Building2,
    hotel: Hotel,
    warehouse: Warehouse,
    store: Store,
    castle: Castle,
  } as const;

  // Check for ?add=true in URL
  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setShowAddProperty(true);
    }
  }, [searchParams]);

  // Extract task counts from properties_view (properties now have open_tasks_count)
  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    properties.forEach((p: any) => {
      counts[p.id] = p.open_tasks_count || 0;
    });
    return counts;
  }, [properties]);

  // Filter properties based on active filter
  const filteredProperties = useMemo(() => {
    if (!activePropertyId) {
      return properties;
    }
    return properties.filter((p: any) => p.id === activePropertyId);
  }, [properties, activePropertyId]);

  if (loading) {
    return (
      <StandardPage
        title="Properties"
        icon={<Building2 className="h-6 w-6" />}
        maxWidth="md"
      >
        <LoadingState message="Loading properties..." />
      </StandardPage>
    );
  }

  return (
    <StandardPage
      title="Properties"
      subtitle={`${properties.length} ${properties.length === 1 ? 'property' : 'properties'}`}
      icon={<Building2 className="h-6 w-6" />}
      action={
        <NeomorphicButton onClick={() => setShowAddProperty(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Property
        </NeomorphicButton>
      }
      maxWidth="md"
    >
      {/* Property Filter Bar */}
      {properties.length > 0 && (
        <div className="mb-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Filter by Property
            </h3>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowAddProperty(true)}
                className="flex items-center justify-center rounded-[5px] transition-all duration-200 hover:bg-muted/30"
                style={{
                  width: '35px',
                  height: '35px',
                }}
                aria-label="Add property"
              >
                <Plus className="h-4 w-[18px] text-muted-foreground" style={{ width: '18px', height: '16px' }} />
              </button>
              {/* Property Icon Buttons */}
              <div className="flex items-center gap-1.5">
                {properties.map((property) => {
                  const iconName = property.icon_name || "home";
                  const IconComponent = PROPERTY_ICONS[iconName as keyof typeof PROPERTY_ICONS] || Home;
                  const iconColor = property.icon_color_hex || "#8EC9CE";
                  const isActive = activePropertyId === property.id;
                  
                  return (
                    <button
                      key={property.id}
                      onClick={() => {
                        // Toggle active state
                        if (activePropertyId === property.id) {
                          setActivePropertyId(null);
                        } else {
                          setActivePropertyId(property.id);
                        }
                      }}
                      className="flex items-center justify-center rounded-[342px] transition-all duration-200 hover:scale-110 active:scale-95"
                      style={{
                        width: '35px',
                        height: '35px',
                        backgroundColor: isActive ? iconColor : 'transparent',
                        boxShadow: isActive 
                          ? "2px 2px 4px 0px rgba(0, 0, 0, 0.1), -1px -1px 2px 0px rgba(255, 255, 255, 0.3), inset 1px 1px 1px 0px rgba(255, 255, 255, 1), inset 0px -1px 3px 0px rgba(0, 0, 0, 0.05)"
                          : "none",
                        borderColor: "rgba(0, 0, 0, 0)",
                        borderStyle: "none",
                        borderImage: "none",
                      }}
                      aria-label={`Filter by ${property.nickname || property.address}`}
                    >
                      <IconComponent className={`h-[18px] w-[18px] ${isActive ? 'text-white' : 'text-muted-foreground'}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {properties.length === 0 ? (
        <EmptyState
          icon={Home}
          title="No properties yet"
          description="Add your first property to get started"
          action={{
            label: "Add Property",
            onClick: () => setShowAddProperty(true),
            icon: Plus
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProperties.map(property => (
            <PropertyCard
              key={property.id}
              property={{
                ...property,
                taskCount: taskCounts[property.id] || 0,
                urgentTaskCount: 0, // TODO: Calculate from tasks if needed
                lastInspectedDate: null, // TODO: Add last inspected date from compliance data
              }}
            />
          ))}
        </div>
      )}

      <AddPropertyDialog
        open={showAddProperty}
        onOpenChange={setShowAddProperty}
      />
    </StandardPage>
  );
};

export default Properties;
