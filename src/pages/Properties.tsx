import { useProperties } from '@/hooks/useProperties';
import { Building2, Plus, Home } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { PropertyCard } from '@/components/properties/PropertyCard';
import { AddPropertyDialog } from '@/components/properties/AddPropertyDialog';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrg } from '@/hooks/useActiveOrg';
import { StandardPage } from '@/components/design-system/StandardPage';
import { NeomorphicButton } from '@/components/design-system/NeomorphicButton';
import { EmptyState } from '@/components/design-system/EmptyState';
import { LoadingState } from '@/components/design-system/LoadingState';

const Properties = () => {
  const { properties, loading } = useProperties();
  const { orgId } = useActiveOrg();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});

  // Check for ?add=true in URL
  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setShowAddProperty(true);
    }
  }, [searchParams]);

  // Fetch task counts for all properties
  useEffect(() => {
    if (!orgId || properties.length === 0) {
      setTaskCounts({});
      return;
    }

    async function fetchTaskCounts() {
      try {
        const propertyIds = properties.map(p => p.id);
        
        const { data, error } = await supabase
          .from("tasks")
          .select("property_id")
          .eq("org_id", orgId)
          .in("property_id", propertyIds)
          .not("property_id", "is", null);

        if (error) {
          console.error("Error fetching task counts:", error);
          return;
        }

        // Count tasks per property
        const counts: Record<string, number> = {};
        (data || []).forEach((task) => {
          if (task.property_id) {
            counts[task.property_id] = (counts[task.property_id] || 0) + 1;
          }
        });

        setTaskCounts(counts);
      } catch (err) {
        console.error("Error fetching task counts:", err);
      }
    }

    fetchTaskCounts();
  }, [orgId, properties]);

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
