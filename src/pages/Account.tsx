import { BottomNav } from '@/components/BottomNav';
import { ContextHeader } from '@/components/ContextHeader';
import { User, Settings, Bell, Shield, Palette, HelpCircle, LogOut, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const Account = () => {
  const navigate = useNavigate();

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

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
      title: 'Organization',
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
    <div className="min-h-screen pb-20 bg-background">
      <ContextHeader 
        title="Account" 
        subtitle="Manage your settings" 
        showSearch={false}
      />

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Profile Card */}
        <div className="rounded-lg p-6 bg-card shadow-e1">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-background shadow-engraved">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                John Doe
              </h2>
              <p className="text-xs mt-0.5 text-muted-foreground">
                john.doe@example.com
              </p>
            </div>
          </div>
        </div>

        {/* Menu Sections */}
        {menuSections.map((section) => (
          <div key={section.title} className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wide px-1 text-muted-foreground">
              {section.title}
            </h3>
            <div className="rounded-lg overflow-hidden bg-card shadow-e1">
              {section.items.map((item, index) => (
                <button
                  key={item.label}
                  onClick={() => navigate(item.path)}
                  className="w-full flex items-center gap-3 p-4 transition-all duration-200 hover:brightness-95 active:scale-[0.99] border-b border-border last:border-b-0"
                >
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                  <span className="flex-1 text-left text-sm font-medium text-foreground">
                    {item.label}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        ))}

        {/* Logout */}
        <div className="rounded-lg overflow-hidden bg-card shadow-e1">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 p-4 transition-all duration-200 hover:brightness-95 active:scale-[0.99]"
          >
            <LogOut className="h-5 w-5 text-destructive" />
            <span className="flex-1 text-left text-sm font-medium text-destructive">
              Log Out
            </span>
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Account;
