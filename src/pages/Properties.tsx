import { BottomNav } from '@/components/BottomNav';
import { useProperties } from '@/hooks/useProperties';
import { Card } from '@/components/ui/card';
import { Home, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { PropertyCard } from '@/components/properties/PropertyCard';
import { AddPropertyDialog } from '@/components/properties/AddPropertyDialog';
import { supabase } from '@/integrations/supabase/client';
import { useActiveOrg } from '@/hooks/useActiveOrg';

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
      <div className="min-h-screen bg-background pb-20">
        <header className="sticky top-0 bg-card border-b border-border z-40">
          <div className="max-w-md mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-foreground">Properties</h1>
          </div>
        </header>
        <div className="max-w-md mx-auto px-4 py-6">
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 bg-card border-b border-border z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Properties</h1>
            <p className="text-sm text-muted-foreground">{properties.length} properties</p>
          </div>
          <Button size="sm" onClick={() => setShowAddProperty(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Property
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {properties.length === 0 ? (
          <Card className="p-8 text-center max-w-md mx-auto">
            <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">No properties yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Add your first property to get started
            </p>
            <Button onClick={() => setShowAddProperty(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Property
            </Button>
          </Card>
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
      </div>

      <AddPropertyDialog
        open={showAddProperty}
        onOpenChange={setShowAddProperty}
      />

      <BottomNav />
    </div>
  );
};

export default Properties;
