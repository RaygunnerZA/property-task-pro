import { usePropertiesQuery } from '@/hooks/usePropertiesQuery';
import { Building2, Plus, Home } from 'lucide-react';
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
          {properties.map(property => (
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
