import { useState } from 'react';
import { Plus, Zap } from 'lucide-react';
import { StandardPage } from '@/components/design-system/StandardPage';
import { EmptyState } from '@/components/design-system/EmptyState';
import { Card } from '@/components/ui/card';
import { NeomorphicButton } from '@/components/design-system/NeomorphicButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  condition?: string;
  action: string;
  enabled: boolean;
}

export default function WorkAutomations() {
  const [rules] = useState<AutomationRule[]>([
    {
      id: '1',
      name: 'Auto-assign urgent tasks',
      trigger: 'New task created',
      condition: 'Priority = High',
      action: 'Assign to Team Lead',
      enabled: true,
    },
    {
      id: '2',
      name: 'Overdue notification',
      trigger: 'Task overdue',
      action: 'Send notification',
      enabled: true,
    },
  ]);

  return (
    <StandardPage
      title="Automations"
      subtitle="Set up rules to automate your workflow"
      icon={<Zap className="h-6 w-6" />}
      action={
        <NeomorphicButton size="sm">
          <Plus className="w-4 h-4 mr-2" />
          New Rule
        </NeomorphicButton>
      }
      maxWidth="lg"
    >
      {rules.length > 0 ? (
        <div className="space-y-4">
          {rules.map((rule) => (
            <Card key={rule.id} className="p-5 shadow-e1">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className={`w-4 h-4 ${rule.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                    <h3 className="text-lg font-semibold text-foreground">{rule.name}</h3>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">When:</span> {rule.trigger}
                    </p>
                    {rule.condition && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">If:</span> {rule.condition}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Then:</span> {rule.action}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                    {rule.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Zap}
          title="No automations yet"
          description="Create rules to automate repetitive tasks"
          action={{
            label: "Create First Rule",
            onClick: () => {},
            icon: Plus
          }}
        />
      )}
    </StandardPage>
  );
}
