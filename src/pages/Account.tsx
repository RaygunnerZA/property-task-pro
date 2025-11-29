import { BottomNav } from '@/components/BottomNav';
import { ContextHeader } from '@/components/ContextHeader';
import { Surface, Heading, Text } from '@/components/filla';
import { User, Settings, Bell, Shield, Palette, HelpCircle, LogOut, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Account = () => {
  const navigate = useNavigate();

  const menuSections = [
    {
      title: 'Profile',
      items: [
        { label: 'Personal Information', icon: User, path: '/account/profile' },
        { label: 'Preferences', icon: Settings, path: '/account/preferences' },
        { label: 'Notifications', icon: Bell, path: '/account/notifications' },
      ],
    },
    {
      title: 'Security',
      items: [
        { label: 'Privacy & Security', icon: Shield, path: '/account/security' },
      ],
    },
    {
      title: 'Developer',
      items: [
        { label: 'Developer Tools', icon: Palette, path: '/account/developer' },
      ],
    },
    {
      title: 'Support',
      items: [
        { label: 'Help & Support', icon: HelpCircle, path: '/account/help' },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-paper pb-20">
      <ContextHeader title="Account" subtitle="Manage your settings" />

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Profile Card */}
        <Surface variant="neomorphic" className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <Heading variant="l">John Doe</Heading>
              <Text variant="caption" className="text-muted-foreground">
                john.doe@example.com
              </Text>
            </div>
          </div>
        </Surface>

        {/* Menu Sections */}
        {menuSections.map((section) => (
          <div key={section.title} className="space-y-2">
            <Heading variant="m" className="px-1 text-muted-foreground">
              {section.title}
            </Heading>
            <Surface variant="neomorphic" className="overflow-hidden">
              {section.items.map((item, index) => (
                <button
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  className={`
                    w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors
                    ${index !== section.items.length - 1 ? 'border-b border-border' : ''}
                  `}
                >
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  <Text variant="body" className="flex-1 text-left">
                    {item.label}
                  </Text>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </Surface>
          </div>
        ))}

        {/* Logout */}
        <Surface variant="neomorphic" className="overflow-hidden">
          <button
            onClick={() => {/* Handle logout */}}
            className="w-full flex items-center gap-3 p-4 hover:bg-destructive/10 transition-colors text-destructive"
          >
            <LogOut className="h-5 w-5" />
            <Text variant="body" className="flex-1 text-left">
              Log Out
            </Text>
          </button>
        </Surface>
      </div>

      <BottomNav />
    </div>
  );
};

export default Account;
