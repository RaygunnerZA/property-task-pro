import { BottomNav } from '@/components/BottomNav';
import { ContextHeader } from '@/components/ContextHeader';
import { Surface, Heading, Text } from '@/components/filla';
import { Palette, Code, Database, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
    <div className="min-h-screen bg-paper pb-20">
      <ContextHeader 
        title="Developer Tools" 
        subtitle="Advanced settings and tools"
        backTo="/account"
      />

      <div className="max-w-md mx-auto px-4 py-6 space-y-3">
        {tools.map((tool) => (
          <Surface
            key={tool.title}
            variant="neomorphic"
            interactive
            onClick={() => navigate(tool.path)}
            className="p-4"
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10">
                <tool.icon className="h-5 w-5 text-primary" />
              </div>
            <div className="flex-1 min-w-0">
              <Heading variant="m" className="mb-1">
                {tool.title}
              </Heading>
                <Text variant="caption" className="text-muted-foreground">
                  {tool.description}
                </Text>
              </div>
            </div>
          </Surface>
        ))}
      </div>

      <BottomNav />
    </div>
  );
};

export default AccountDeveloper;
