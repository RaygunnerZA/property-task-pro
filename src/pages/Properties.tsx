import { BottomNav } from '@/components/BottomNav';
import { useProperties } from '@/hooks/useProperties';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Home, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal';
import { useState, useEffect } from 'react';

const Properties = () => {
  const { properties, loading } = useProperties();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showAddProperty, setShowAddProperty] = useState(false);

  // Check for ?add=true in URL
  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      navigate('/onboarding/add-property');
    }
  }, [searchParams, navigate]);

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
        <div className="max-w-md mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Properties</h1>
            <p className="text-sm text-muted-foreground">{properties.length} properties</p>
          </div>
          <Button size="sm" onClick={() => navigate('/onboarding/add-property')}>
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {properties.length === 0 ? (
          <Card className="p-8 text-center">
            <Home className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">No properties yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Add your first property to get started
            </p>
            <Button onClick={() => navigate('/onboarding/add-property')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Property
            </Button>
          </Card>
        ) : (
          properties.map(property => (
            <Card key={property.id} className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/property/${property.id}/tasks`)}>
              <CardHeader>
                <CardTitle className="text-lg flex items-start justify-between gap-3">
                  <span>{property.nickname || property.address}</span>
                  {property.health_score && property.health_score < 80 && (
                    <Badge variant="secondary" className="bg-destructive text-destructive-foreground">
                      Needs attention
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-muted-foreground">{property.address}</p>
                </div>
                {property.units && property.units > 1 && (
                  <p className="text-xs text-muted-foreground">{property.units} units</p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default Properties;
