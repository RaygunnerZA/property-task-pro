import { useState } from 'react';
import { Surface, Heading, Text, Button } from '@/components/filla';
import { Plus, Zap } from 'lucide-react';

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
    <div className="p-6 max-w-4xl mx-auto pb-24">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Heading variant="l" className="mb-2">Automations</Heading>
          <Text variant="muted">
            Set up rules to automate your workflow
          </Text>
        </div>
        <Button variant="primary" size="md">
          <Plus className="w-4 h-4 mr-2" />
          New Rule
        </Button>
      </div>

      <div className="space-y-4">
        {rules.map((rule) => (
          <Surface key={rule.id} variant="neomorphic" className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className={`w-4 h-4 ${rule.enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                  <Heading variant="m">{rule.name}</Heading>
                </div>
                
                <div className="space-y-1">
                  <Text variant="caption" className="text-muted-foreground">
                    <span className="font-medium">When:</span> {rule.trigger}
                  </Text>
                  {rule.condition && (
                    <Text variant="caption" className="text-muted-foreground">
                      <span className="font-medium">If:</span> {rule.condition}
                    </Text>
                  )}
                  <Text variant="caption" className="text-muted-foreground">
                    <span className="font-medium">Then:</span> {rule.action}
                  </Text>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  variant={rule.enabled ? 'primary' : 'secondary'}
                  size="sm"
                >
                  {rule.enabled ? 'Enabled' : 'Disabled'}
                </Button>
                <Button variant="ghost" size="sm">
                  Edit
                </Button>
              </div>
            </div>
          </Surface>
        ))}
      </div>

      {rules.length === 0 && (
        <Surface variant="neomorphic" className="p-12 text-center">
          <Zap className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
          <Heading variant="m" className="mb-2">No automations yet</Heading>
          <Text variant="muted" className="mb-4">
            Create rules to automate repetitive tasks
          </Text>
          <Button variant="primary" size="md">
            <Plus className="w-4 h-4 mr-2" />
            Create First Rule
          </Button>
        </Surface>
      )}
    </div>
  );
}
