import { BottomNav } from '@/components/BottomNav';
import { mockProperties, mockTasks } from '@/data/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, ClipboardList } from 'lucide-react';

const Properties = () => {
  const getTaskCount = (propertyId: string) => {
    return mockTasks.filter(task => task.propertyId === propertyId).length;
  };

  const getActiveTaskCount = (propertyId: string) => {
    return mockTasks.filter(
      task => task.propertyId === propertyId && task.status !== 'completed'
    ).length;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 bg-card border-b border-border z-40">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">Properties</h1>
          <p className="text-sm text-muted-foreground">{mockProperties.length} properties</p>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {mockProperties.map(property => {
          const totalTasks = getTaskCount(property.id);
          const activeTasks = getActiveTaskCount(property.id);
          
          return (
            <Card key={property.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg flex items-start justify-between gap-3">
                  <span>{property.name}</span>
                  {activeTasks > 0 && (
                    <Badge variant="secondary" className="bg-primary text-primary-foreground">
                      {activeTasks} active
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-muted-foreground">{property.address}</p>
                    <p className="text-muted-foreground">{property.type}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
                  <ClipboardList className="h-4 w-4" />
                  <span>{totalTasks} total tasks</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <BottomNav />
    </div>
  );
};

export default Properties;
