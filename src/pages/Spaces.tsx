import { BottomNav } from '@/components/BottomNav';
import { FloatingAddButton } from '@/components/FloatingAddButton';
import { ContextHeader } from '@/components/ContextHeader';
import { mockProperties, mockTasks } from '@/data/mockData';
import { useNavigate } from 'react-router-dom';
import { Building2, MapPin, CheckCircle2 } from 'lucide-react';

const Spaces = () => {
  const navigate = useNavigate();

  const getTaskCount = (propertyId: string) => {
    return mockTasks.filter(t => t.propertyId === propertyId && t.status !== 'completed').length;
  };

  return (
    <div className="min-h-screen pb-20 bg-background">
      <ContextHeader 
        title="Spaces" 
        subtitle={`${mockProperties.length} properties`}
      />

      <div className="max-w-md mx-auto px-4 py-6 space-y-3">
        {mockProperties.map(property => {
          const activeTasks = getTaskCount(property.id);
          
          return (
            <button
              key={property.id}
              onClick={() => navigate(`/properties/${property.id}/compliance`)}
              className="w-full text-left rounded-lg p-4 bg-card shadow-e1 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="p-3 rounded-lg shrink-0 bg-background shadow-engraved">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold tracking-tight truncate mb-1 text-foreground">
                    {property.name}
                  </h3>
                  <div className="flex items-center gap-1.5 mb-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="text-sm truncate text-muted-foreground">
                      {property.address}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-background text-muted-foreground border border-border">
                  {property.type}
                </span>
                {activeTasks > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 bg-signal/30 text-foreground border border-signal/60">
                    <CheckCircle2 className="h-3 w-3" />
                    {activeTasks} active task{activeTasks !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <FloatingAddButton />
      <BottomNav />
    </div>
  );
};

export default Spaces;
