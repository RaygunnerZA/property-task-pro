import { BottomNav } from '@/components/BottomNav';
import { FloatingAddButton } from '@/components/FloatingAddButton';
import { ContextHeader } from '@/components/ContextHeader';
import { mockProperties, mockTasks } from '@/data/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Building2, MapPin } from 'lucide-react';

const Spaces = () => {
  const navigate = useNavigate();

  const getTaskCount = (propertyId: string) => {
    return mockTasks.filter(t => t.propertyId === propertyId && t.status !== 'completed').length;
  };

  return (
    <div className="min-h-screen bg-paper pb-20">
      <ContextHeader 
        title="Spaces" 
        subtitle={`${mockProperties.length} properties`}
      />

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {mockProperties.map(property => {
          const totalTasks = getTaskCount(property.id);
          
          return (
            <Card 
              key={property.id}
              className="cursor-pointer hover:shadow-lg transition-all"
              onClick={() => navigate(`/properties/${property.id}/compliance`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base font-semibold truncate">
                        {property.name}
                      </CardTitle>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{property.address}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {property.type}
                  </Badge>
                  {totalTasks > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {totalTasks} active task{totalTasks !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <FloatingAddButton />
      <BottomNav />
    </div>
  );
};

export default Spaces;
