import { BottomNav } from '@/components/BottomNav';
import { FloatingAddButton } from '@/components/FloatingAddButton';
import { ContextHeader } from '@/components/ContextHeader';
import { Surface, Heading, Text } from '@/components/filla';
import { CheckSquare, Calendar, Building2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();

  const stats = [
    { label: 'Active Tasks', value: 12, icon: CheckSquare, color: 'text-primary', link: '/work' },
    { label: 'This Week', value: 8, icon: Calendar, color: 'text-signal', link: '/work' },
    { label: 'Properties', value: 4, icon: Building2, color: 'text-accent', link: '/spaces' },
    { label: 'Urgent', value: 3, icon: AlertCircle, color: 'text-destructive', link: '/work' },
  ];

  return (
    <div className="min-h-screen bg-paper pb-20">
      <ContextHeader title="Home" subtitle="Your workspace overview" />

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat) => (
            <Surface
              key={stat.label}
              variant="neomorphic"
              interactive
              onClick={() => navigate(stat.link)}
              className="p-4"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <Text variant="caption" className="text-muted-foreground">
                    {stat.label}
                  </Text>
                  <Heading variant="l" className="mt-0.5">
                    {stat.value}
                  </Heading>
                </div>
              </div>
            </Surface>
          ))}
        </div>

        {/* Recent Activity */}
        <div>
          <Heading variant="m" className="mb-3 px-1">
            Recent Activity
          </Heading>
          <Surface variant="neomorphic" className="p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <Text variant="body" className="flex-1">
                  Task completed: Fire safety inspection
                </Text>
                <Text variant="caption" className="text-muted-foreground">
                  2h ago
                </Text>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-signal" />
                <Text variant="body" className="flex-1">
                  New task assigned: HVAC maintenance
                </Text>
                <Text variant="caption" className="text-muted-foreground">
                  5h ago
                </Text>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-accent" />
                <Text variant="body" className="flex-1">
                  Property updated: 123 Main St
                </Text>
                <Text variant="caption" className="text-muted-foreground">
                  1d ago
                </Text>
              </div>
            </div>
          </Surface>
        </div>
      </div>

      <FloatingAddButton />
      <BottomNav />
    </div>
  );
};

export default Home;
