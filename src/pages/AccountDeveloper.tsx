import { Palette, Code, Database, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StandardPageWithBack } from '@/components/design-system/StandardPageWithBack';
import { Card } from '@/components/ui/card';

const AccountDeveloper = () => {
  const navigate = useNavigate();

  const tools = [
    {
      title: 'Design System',
      description: 'View and test design tokens, colors, and components',
      icon: Palette,
      path: '/schedule', // Keeping Schedule as the Design tab location
    },
    {
      title: 'API Access',
      description: 'Manage API keys and integrations',
      icon: Code,
      path: '/account/developer/api',
    },
    {
      title: 'Database',
      description: 'View database schema and manage data',
      icon: Database,
      path: '/account/developer/database',
    },
    {
      title: 'Performance',
      description: 'Monitor app performance and logs',
      icon: Zap,
      path: '/account/developer/performance',
    },
  ];

  return (
    <StandardPageWithBack
      title="Developer Tools"
      subtitle="Advanced settings and tools"
      backTo="/account"
      icon={<Code className="h-6 w-6" />}
      maxWidth="md"
    >
      <div className="space-y-3">
        {tools.map((tool) => (
          <Card
            key={tool.title}
            className="p-4 shadow-e1 cursor-pointer hover:scale-[1.01] transition-all"
            onClick={() => navigate(tool.path)}
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10">
                <tool.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold mb-1 text-foreground">
                  {tool.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {tool.description}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </StandardPageWithBack>
  );
};

export default AccountDeveloper;
